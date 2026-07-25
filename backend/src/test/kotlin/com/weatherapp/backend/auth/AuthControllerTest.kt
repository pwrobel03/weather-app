package com.weatherapp.backend.auth

import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
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
import org.testcontainers.containers.wait.strategy.Wait
import org.testcontainers.junit.jupiter.Container
import org.testcontainers.junit.jupiter.Testcontainers
import org.springframework.web.client.HttpClientErrorException
import org.springframework.web.client.RestClient
import java.time.Duration
import kotlin.test.assertEquals
import kotlin.test.assertNotEquals

@Testcontainers
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class AuthControllerTest {

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
    fun `registers a new user and returns a token pair`() {
        val tokens = register("alice@example.com", "correct-horse-battery")

        assertNotEquals("", tokens.accessToken)
        assertNotEquals("", tokens.refreshToken)
    }

    @Test
    fun `rejects registration with an already used email`() {
        register("bob@example.com", "correct-horse-battery")

        val exception = assertThrows<HttpClientErrorException> {
            register("bob@example.com", "another-password-here")
        }
        assertEquals(409, exception.statusCode.value())
    }

    @Test
    fun `rejects registration with a too-short password`() {
        val exception = assertThrows<HttpClientErrorException> {
            register("short@example.com", "short")
        }
        assertEquals(400, exception.statusCode.value())
    }

    @Test
    fun `logs in with correct credentials`() {
        register("carol@example.com", "correct-horse-battery")

        val tokens = login("carol@example.com", "correct-horse-battery")

        assertNotEquals("", tokens.accessToken)
    }

    @Test
    fun `rejects login with a wrong password`() {
        register("dave@example.com", "correct-horse-battery")

        val exception = assertThrows<HttpClientErrorException> {
            login("dave@example.com", "wrong-password")
        }
        assertEquals(401, exception.statusCode.value())
    }

    @Test
    fun `rejects login for an unknown email`() {
        val exception = assertThrows<HttpClientErrorException> {
            login("nobody@example.com", "whatever-password")
        }
        assertEquals(401, exception.statusCode.value())
    }

    @Test
    fun `refresh issues a new token pair and rotates out the old refresh token`() {
        val tokens = register("erin@example.com", "correct-horse-battery")

        val refreshed = refresh(tokens.refreshToken)

        assertNotEquals(tokens.accessToken, refreshed.accessToken)
        assertNotEquals(tokens.refreshToken, refreshed.refreshToken)

        // reusing the now-revoked refresh token must fail
        val exception = assertThrows<HttpClientErrorException> { refresh(tokens.refreshToken) }
        assertEquals(401, exception.statusCode.value())
    }

    @Test
    fun `rejects a garbage refresh token`() {
        val exception = assertThrows<HttpClientErrorException> { refresh("not-a-real-token") }
        assertEquals(401, exception.statusCode.value())
    }

    private fun register(email: String, password: String): AuthResponse =
        post("/api/auth/register", mapOf("email" to email, "password" to password))

    private fun login(email: String, password: String): AuthResponse =
        post("/api/auth/login", mapOf("email" to email, "password" to password))

    private fun refresh(refreshToken: String): AuthResponse =
        post("/api/auth/refresh", mapOf("refreshToken" to refreshToken))

    private fun post(uri: String, body: Map<String, String>): AuthResponse {
        val json = client.post()
            .uri(uri)
            .contentType(MediaType.APPLICATION_JSON)
            .body(body)
            .retrieve()
            .body(String::class.java)!!
        return objectMapper.readValue<AuthResponse>(json)
    }
}
