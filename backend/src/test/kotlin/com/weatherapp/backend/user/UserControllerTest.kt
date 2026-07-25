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
