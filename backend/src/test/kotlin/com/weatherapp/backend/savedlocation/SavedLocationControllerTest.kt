package com.weatherapp.backend.savedlocation

import com.fasterxml.jackson.databind.DeserializationFeature
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import com.weatherapp.backend.KartozaPostgisContainer
import com.weatherapp.backend.auth.AuthResponse
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.web.server.LocalServerPort
import org.springframework.http.HttpHeaders
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

@Testcontainers
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class SavedLocationControllerTest {

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
        .disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)

    @BeforeEach
    fun setUp() {
        jdbcTemplate.update("TRUNCATE users CASCADE")
        client = RestClient.create("http://localhost:$port")
    }

    @Test
    fun `rejects listing without a token`() {
        val exception = assertThrows<HttpClientErrorException> {
            client.get().uri("/api/users/me/locations").retrieve().body(String::class.java)
        }
        assertEquals(401, exception.statusCode.value())
    }

    @Test
    fun `creates and lists a saved location`() {
        val token = registerAndGetAccessToken("alice@example.com")

        val created = save(token, "Dom", 52.23, 21.01)
        assertEquals("Dom", created.name)

        val locations = list(token)
        assertEquals(1, locations.size)
        assertEquals("Dom", locations[0].name)
    }

    @Test
    fun `rejects a duplicate save for the same coordinates`() {
        val token = registerAndGetAccessToken("bob@example.com")
        save(token, "Dom", 52.23, 21.01)

        val exception = assertThrows<HttpClientErrorException> { save(token, "Ponownie", 52.23, 21.01) }
        assertEquals(409, exception.statusCode.value())
    }

    @Test
    fun `rejects out-of-range coordinates`() {
        val token = registerAndGetAccessToken("carol@example.com")

        val exception = assertThrows<HttpClientErrorException> { save(token, "Bad", 200.0, 21.01) }
        assertEquals(400, exception.statusCode.value())
    }

    @Test
    fun `deletes a saved location`() {
        val token = registerAndGetAccessToken("dave@example.com")
        val created = save(token, "Dom", 52.23, 21.01)

        client.delete()
            .uri("/api/users/me/locations/${created.id}")
            .header(HttpHeaders.AUTHORIZATION, "Bearer $token")
            .retrieve()
            .toBodilessEntity()

        assertTrue(list(token).isEmpty())
    }

    @Test
    fun `rejects deleting a location that does not belong to the caller`() {
        val ownerToken = registerAndGetAccessToken("erin@example.com")
        val otherToken = registerAndGetAccessToken("frank@example.com")
        val created = save(ownerToken, "Dom", 52.23, 21.01)

        val exception = assertThrows<HttpClientErrorException> {
            client.delete()
                .uri("/api/users/me/locations/${created.id}")
                .header(HttpHeaders.AUTHORIZATION, "Bearer $otherToken")
                .retrieve()
                .toBodilessEntity()
        }
        assertEquals(404, exception.statusCode.value())

        // still there for the actual owner
        assertEquals(1, list(ownerToken).size)
    }

    private fun registerAndGetAccessToken(email: String): String {
        val json = client.post()
            .uri("/api/auth/register")
            .contentType(MediaType.APPLICATION_JSON)
            .body(mapOf("email" to email, "password" to "correct-horse-battery"))
            .retrieve()
            .body(String::class.java)!!
        return objectMapper.readValue<AuthResponse>(json).accessToken
    }

    private fun save(token: String, name: String, latitude: Double, longitude: Double): SavedLocation {
        val json = client.post()
            .uri("/api/users/me/locations")
            .header(HttpHeaders.AUTHORIZATION, "Bearer $token")
            .contentType(MediaType.APPLICATION_JSON)
            .body(mapOf("name" to name, "latitude" to latitude, "longitude" to longitude))
            .retrieve()
            .body(String::class.java)!!
        return objectMapper.readValue<SavedLocationResponse>(json).toDomain()
    }

    private fun list(token: String): List<SavedLocation> {
        val json = client.get()
            .uri("/api/users/me/locations")
            .header(HttpHeaders.AUTHORIZATION, "Bearer $token")
            .retrieve()
            .body(String::class.java)!!
        return objectMapper.readValue<List<SavedLocationResponse>>(json).map { it.toDomain() }
    }

    // Mirrors the JSON shape without depending on java.time.Instant Jackson
    // module wiring in the test's own ObjectMapper.
    private data class SavedLocationResponse(
        val id: Long,
        val userId: Long,
        val name: String,
        val latitude: Double,
        val longitude: Double,
        val terytCode: String?,
    ) {
        fun toDomain() = SavedLocation(id, userId, name, latitude, longitude, terytCode, java.time.Instant.EPOCH)
    }
}
