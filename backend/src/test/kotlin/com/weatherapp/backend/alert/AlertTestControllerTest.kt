package com.weatherapp.backend.alert

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.weatherapp.backend.KartozaPostgisContainer
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.web.server.LocalServerPort
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
import kotlin.test.assertTrue

/**
 * The injector exists to make an unverifiable path verifiable, so the tests
 * that matter are the ones about who may use it and how obvious it is that the
 * result is not real.
 */
@Testcontainers
@SpringBootTest(
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = ["alert-ingest.enabled=false"],
)
class AlertTestControllerTest {

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
        jdbcTemplate.update("TRUNCATE alert CASCADE")
        jdbcTemplate.update("TRUNCATE users CASCADE")
        jdbcTemplate.update("TRUNCATE powiat_boundary CASCADE")
        jdbcTemplate.update(
            """
            INSERT INTO powiat_boundary (teryt_code, name, voivodeship, boundary)
            VALUES ('1465', 'powiat Warszawa', 'mazowieckie',
                    ST_GeogFromText('MULTIPOLYGON(((20.99 52.21, 20.99 52.25, 21.03 52.25, 21.03 52.21, 20.99 52.21)))'))
            """.trimIndent(),
        )
        client = RestClient.create("http://localhost:$port")
    }

    @Test
    fun `refuses a caller who is not an admin`() {
        val token = register("zwykly@example.com")

        val error = assertThrows<HttpClientErrorException> { publish(token, 52.23, 21.01) }

        // The guard that keeps a fake warning from reaching a real user.
        assertEquals(403, error.statusCode.value())
    }

    @Test
    fun `refuses an anonymous caller`() {
        val error = assertThrows<HttpClientErrorException> { publish(null, 52.23, 21.01) }
        assertEquals(401, error.statusCode.value())
    }

    @Test
    fun `publishes a warning marked as a test`() {
        val token = admin("admin@example.com")

        val result = publish(token, 52.23, 21.01)

        assertEquals("1465", result["terytCode"].asText())
        val event = jdbcTemplate.queryForObject("SELECT event FROM alert", String::class.java)!!
        // Legible as a test at a glance, in either language, wherever it shows
        // up - device, screenshot or database.
        assertTrue(event.startsWith("TEST"), "event was: $event")
        assertTrue(event.contains("próbne") && event.contains("test"))
    }

    @Test
    fun `matches the saved locations in that powiat, so the whole path runs`() {
        val token = admin("admin2@example.com")
        val userId = jdbcTemplate.queryForObject(
            "SELECT id FROM users WHERE email = 'admin2@example.com'", Long::class.java,
        )!!
        jdbcTemplate.update(
            """
            INSERT INTO saved_location (user_id, name, latitude, longitude, teryt_code)
            VALUES (?, 'Dom', 52.23, 21.01, '1465')
            """.trimIndent(),
            userId,
        )

        val result = publish(token, 52.23, 21.01)

        assertEquals(1, result["matchedLocations"].asInt())
    }

    @Test
    fun `publishes a new warning each time rather than updating the previous one`() {
        val token = admin("admin3@example.com")

        publish(token, 52.23, 21.01)
        publish(token, 52.23, 21.01)

        // Keyed on a fresh id per call: a fixed one would upsert, and the second
        // press of the button would appear to do nothing.
        assertEquals(2, jdbcTemplate.queryForObject("SELECT count(*) FROM alert", Int::class.java))
    }

    @Test
    fun `rejects a point outside every known powiat`() {
        val token = admin("admin4@example.com")

        val error = assertThrows<HttpClientErrorException> { publish(token, 0.0, 0.0) }

        assertEquals(400, error.statusCode.value())
    }

    private fun publish(token: String?, latitude: Double, longitude: Double): JsonNode {
        var request = client.post()
            .uri("/api/admin/alerts/test")
            .contentType(MediaType.APPLICATION_JSON)
        if (token != null) request = request.header("Authorization", "Bearer $token")
        val body = request
            .body(mapOf("latitude" to latitude, "longitude" to longitude))
            .retrieve()
            .body(String::class.java)!!
        return objectMapper.readTree(body)
    }

    private fun register(email: String): String {
        val body = client.post()
            .uri("/api/auth/register")
            .contentType(MediaType.APPLICATION_JSON)
            .body(mapOf("email" to email, "password" to "correct-horse-battery"))
            .retrieve()
            .body(String::class.java)!!
        return objectMapper.readTree(body)["accessToken"].asText()
    }

    /** Registers, promotes to ADMIN, then signs in again so the token carries the role. */
    private fun admin(email: String): String {
        register(email)
        jdbcTemplate.update("UPDATE users SET role = 'ADMIN' WHERE email = ?", email)
        val body = client.post()
            .uri("/api/auth/login")
            .contentType(MediaType.APPLICATION_JSON)
            .body(mapOf("email" to email, "password" to "correct-horse-battery"))
            .retrieve()
            .body(String::class.java)!!
        return objectMapper.readTree(body)["accessToken"].asText()
    }
}
