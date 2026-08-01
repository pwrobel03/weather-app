package com.weatherapp.backend.boundary

import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import com.weatherapp.backend.KartozaPostgisContainer
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.web.server.LocalServerPort
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.springframework.web.client.HttpClientErrorException
import org.springframework.web.client.RestClient
import org.testcontainers.containers.wait.strategy.Wait
import org.testcontainers.junit.jupiter.Container
import org.testcontainers.junit.jupiter.Testcontainers
import java.time.Duration
import kotlin.test.assertEquals
import kotlin.test.assertNull

@Testcontainers
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class BoundaryAdminControllerTest {

    companion object {
        @Container
        @JvmStatic
        val postgres: KartozaPostgisContainer = KartozaPostgisContainer("kartoza/postgis:17-3.5")
            .withExposedPorts(5432)
            .withEnv("POSTGRES_USER", "weather")
            .withEnv("POSTGRES_PASSWORD", "weather")
            .withEnv("POSTGRES_DB", "weather")
            .waitingFor(
                Wait.forLogMessage(".*database system is ready to accept connections.*\\n", 2)
                    .withStartupTimeout(Duration.ofSeconds(90)),
            )

        @JvmStatic
        @DynamicPropertySource
        fun properties(registry: DynamicPropertyRegistry) {
            registry.add("spring.datasource.url") {
                "jdbc:postgresql://${postgres.host}:${postgres.getMappedPort(5432)}/weather"
            }
            registry.add("spring.datasource.username") { "weather" }
            registry.add("spring.datasource.password") { "weather" }
        }
    }

    @LocalServerPort
    var port: Int = 0

    @Autowired
    lateinit var jdbcTemplate: JdbcTemplate

    private lateinit var client: RestClient
    private val objectMapper = jacksonObjectMapper()

    @BeforeEach
    fun setUp() {
        jdbcTemplate.update("TRUNCATE users CASCADE")
        jdbcTemplate.update("TRUNCATE powiat_boundary")
        client = RestClient.create("http://localhost:$port")
    }

    @Test
    fun `rejects anonymous callers`() {
        val error = expectError { refresh(token = null) }
        assertEquals(HttpStatus.UNAUTHORIZED, error.statusCode)
    }

    @Test
    fun `rejects authenticated non-admin callers`() {
        val token = registerAndPromote("user@example.com", promoteToAdmin = false)
        val error = expectError { refresh(token) }
        assertEquals(HttpStatus.FORBIDDEN, error.statusCode)
    }

    @Test
    fun `recomputes teryt codes against the current boundaries`() {
        val token = registerAndPromote("admin@example.com", promoteToAdmin = true)
        val userId = jdbcTemplate.queryForObject(
            "SELECT id FROM users WHERE email = ?",
            Long::class.java,
            "admin@example.com",
        )!!

        // Saved with no boundary loaded yet, so it starts unresolved.
        jdbcTemplate.update(
            "INSERT INTO saved_location (user_id, name, latitude, longitude) VALUES (?, ?, ?, ?)",
            userId,
            "Testowo",
            0.5,
            0.5,
        )
        assertNull(currentTerytCode(userId))

        // A boundary now covers that point - exactly the boundary-import case.
        jdbcTemplate.update(
            """
            INSERT INTO powiat_boundary (teryt_code, name, voivodeship, boundary)
            VALUES ('9999', 'Testowo', 'testowe', ST_GeogFromText('MULTIPOLYGON(((0 0, 0 1, 1 1, 1 0, 0 0)))'))
            """.trimIndent(),
        )

        assertEquals(1, refresh(token).updatedLocations)
        assertEquals("9999", currentTerytCode(userId))

        // Idempotent: a second run finds nothing left to change.
        assertEquals(0, refresh(token).updatedLocations)
    }

    @Test
    fun `clears codes for locations no longer covered by any boundary`() {
        val token = registerAndPromote("admin@example.com", promoteToAdmin = true)
        val userId = jdbcTemplate.queryForObject(
            "SELECT id FROM users WHERE email = ?",
            Long::class.java,
            "admin@example.com",
        )!!

        jdbcTemplate.update(
            "INSERT INTO saved_location (user_id, name, latitude, longitude, teryt_code) VALUES (?, ?, ?, ?, ?)",
            userId,
            "Zagranica",
            48.85,
            2.35,
            "1465",
        )

        // No boundary contains Paris, so the stale code must be cleared rather
        // than left pointing at a powiat the location was never in.
        assertEquals(1, refresh(token).updatedLocations)
        assertNull(currentTerytCode(userId))
    }

    private fun currentTerytCode(userId: Long): String? =
        jdbcTemplate.query(
            "SELECT teryt_code FROM saved_location WHERE user_id = ?",
            { rs, _ -> rs.getString("teryt_code") },
            userId,
        ).first()

    private fun registerAndPromote(email: String, promoteToAdmin: Boolean): String {
        val body = client.post()
            .uri("/api/auth/register")
            .contentType(MediaType.APPLICATION_JSON)
            .body(mapOf("email" to email, "password" to "correct-horse-battery"))
            .retrieve()
            .body(String::class.java)!!

        if (!promoteToAdmin) {
            return objectMapper.readValue<Map<String, String>>(body).getValue("accessToken")
        }

        // Promotion is a manual UPDATE by design - there is no self-service
        // path to ADMIN. Log in again so the new role lands in a fresh token.
        jdbcTemplate.update("UPDATE users SET role = 'ADMIN' WHERE email = ?", email)
        val loginBody = client.post()
            .uri("/api/auth/login")
            .contentType(MediaType.APPLICATION_JSON)
            .body(mapOf("email" to email, "password" to "correct-horse-battery"))
            .retrieve()
            .body(String::class.java)!!
        return objectMapper.readValue<Map<String, String>>(loginBody).getValue("accessToken")
    }

    private fun refresh(token: String?): TerytRefreshResult {
        val request = client.post().uri("/api/admin/boundaries/refresh")
        token?.let { request.header("Authorization", "Bearer $it") }
        return objectMapper.readValue(request.retrieve().body(String::class.java)!!)
    }

    private fun expectError(block: () -> Unit): HttpClientErrorException =
        try {
            block()
            throw AssertionError("expected an HTTP error response")
        } catch (ex: HttpClientErrorException) {
            ex
        }
}
