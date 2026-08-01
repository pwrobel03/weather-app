package com.weatherapp.backend.user

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

@Testcontainers
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class UserControllerTest {

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
        client = RestClient.create("http://localhost:$port")
    }

    @Test
    fun `health check stays public without a token`() {
        val body = client.get().uri("/health").retrieve().body(String::class.java)
        assertEquals("""{"status":"UP"}""", body)
    }

    @Test
    fun `rejects a request with no token`() {
        val exception = assertThrows<HttpClientErrorException> {
            client.get().uri("/api/users/me").retrieve().body(String::class.java)
        }
        assertEquals(401, exception.statusCode.value())
    }

    @Test
    fun `rejects a garbage bearer token`() {
        val exception = assertThrows<HttpClientErrorException> {
            client.get()
                .uri("/api/users/me")
                .header(HttpHeaders.AUTHORIZATION, "Bearer not-a-real-token")
                .retrieve()
                .body(String::class.java)
        }
        assertEquals(401, exception.statusCode.value())
    }

    @Test
    fun `rejects a refresh token used as a bearer access token`() {
        val tokens = register("wrong-token-type@example.com", "correct-horse-battery")

        val exception = assertThrows<HttpClientErrorException> {
            client.get()
                .uri("/api/users/me")
                .header(HttpHeaders.AUTHORIZATION, "Bearer ${tokens.refreshToken}")
                .retrieve()
                .body(String::class.java)
        }
        assertEquals(401, exception.statusCode.value())
    }

    @Test
    fun `returns the current user's profile for a valid access token`() {
        val tokens = register("me@example.com", "correct-horse-battery")

        val body = client.get()
            .uri("/api/users/me")
            .header(HttpHeaders.AUTHORIZATION, "Bearer ${tokens.accessToken}")
            .retrieve()
            .body(String::class.java)!!

        val user = objectMapper.readValue<UserResponse>(body)
        assertEquals("me@example.com", user.email)
    }

    @Test
    fun `defaults to metric preferences on registration`() {
        val tokens = register("defaults@example.com", "correct-horse-battery")

        val user = me(tokens.accessToken)

        assertEquals(TemperatureUnit.CELSIUS, user.temperatureUnit)
        assertEquals(WindSpeedUnit.KMH, user.windSpeedUnit)
        assertEquals(PrecipitationUnit.MM, user.precipitationUnit)
    }

    @Test
    fun `updates only the given preference, leaving the rest unchanged`() {
        val tokens = register("prefs@example.com", "correct-horse-battery")

        val response = client.patch()
            .uri("/api/users/me/preferences")
            .header(HttpHeaders.AUTHORIZATION, "Bearer ${tokens.accessToken}")
            .contentType(MediaType.APPLICATION_JSON)
            .body(mapOf("temperatureUnit" to "FAHRENHEIT"))
            .retrieve()
            .body(String::class.java)!!

        val updated = objectMapper.readValue<UserResponse>(response)
        assertEquals(TemperatureUnit.FAHRENHEIT, updated.temperatureUnit)
        assertEquals(WindSpeedUnit.KMH, updated.windSpeedUnit)
        assertEquals(PrecipitationUnit.MM, updated.precipitationUnit)

        // persisted, not just returned once
        assertEquals(TemperatureUnit.FAHRENHEIT, me(tokens.accessToken).temperatureUnit)
    }

    @Test
    fun `rejects updating preferences without a token`() {
        val exception = assertThrows<HttpClientErrorException> {
            client.patch()
                .uri("/api/users/me/preferences")
                .contentType(MediaType.APPLICATION_JSON)
                .body(mapOf("temperatureUnit" to "FAHRENHEIT"))
                .retrieve()
                .body(String::class.java)
        }
        assertEquals(401, exception.statusCode.value())
    }

    @Test
    fun `registers and unregisters push notification tokens`() {
        val tokens = register("push@example.com", "correct-horse-battery")

        client.post()
            .uri("/api/users/me/push-tokens")
            .header(HttpHeaders.AUTHORIZATION, "Bearer ${tokens.accessToken}")
            .contentType(MediaType.APPLICATION_JSON)
            .body(mapOf("token" to "ExponentPushToken[1234567890]"))
            .retrieve()
            .toBodilessEntity()

        val savedCount = jdbcTemplate.queryForObject(
            "SELECT count(*) FROM user_push_token WHERE token = ?",
            Long::class.java,
            "ExponentPushToken[1234567890]",
        )!!
        assertEquals(1L, savedCount)

        client.delete()
            .uri("/api/users/me/push-tokens?token=ExponentPushToken[1234567890]")
            .header(HttpHeaders.AUTHORIZATION, "Bearer ${tokens.accessToken}")
            .retrieve()
            .toBodilessEntity()

        val afterDelete = jdbcTemplate.queryForObject(
            "SELECT count(*) FROM user_push_token WHERE token = ?",
            Long::class.java,
            "ExponentPushToken[1234567890]",
        )!!
        assertEquals(0L, afterDelete)
    }

    private fun me(accessToken: String): UserResponse {
        val body = client.get()
            .uri("/api/users/me")
            .header(HttpHeaders.AUTHORIZATION, "Bearer $accessToken")
            .retrieve()
            .body(String::class.java)!!
        return objectMapper.readValue<UserResponse>(body)
    }

    private fun register(email: String, password: String): AuthResponse {
        val json = client.post()
            .uri("/api/auth/register")
            .contentType(MediaType.APPLICATION_JSON)
            .body(mapOf("email" to email, "password" to password))
            .retrieve()
            .body(String::class.java)!!
        return objectMapper.readValue<AuthResponse>(json)
    }
}
