package com.weatherapp.backend.auth

import com.weatherapp.backend.KartozaPostgisContainer
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.web.server.LocalServerPort
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.springframework.test.context.TestPropertySource
import org.springframework.web.client.HttpClientErrorException
import org.springframework.web.client.RestClient
import org.testcontainers.containers.wait.strategy.Wait
import org.testcontainers.junit.jupiter.Container
import org.testcontainers.junit.jupiter.Testcontainers
import java.time.Duration
import kotlin.test.assertEquals
import kotlin.test.assertNotNull

@Testcontainers
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestPropertySource(
    properties = [
        "rate-limit.login.limit=3",
        "rate-limit.login.window=15m",
        "rate-limit.register.limit=2",
        "rate-limit.register.window=1h",
    ],
)
class RateLimitFilterTest {

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

    @Autowired
    lateinit var rateLimiter: RateLimiter

    private lateinit var client: RestClient

    @BeforeEach
    fun setUp() {
        jdbcTemplate.update("TRUNCATE users CASCADE")
        rateLimiter.reset()
        client = RestClient.create("http://localhost:$port")
    }

    @Test
    fun `blocks login attempts once the window budget is spent`() {
        // Three wrong passwords are allowed through to the credential check.
        repeat(3) {
            val rejected = assertThrows { postLogin("nobody@example.com", "wrong-password") }
            assertEquals(HttpStatus.UNAUTHORIZED, rejected.statusCode)
        }

        val limited = assertThrows { postLogin("nobody@example.com", "wrong-password") }
        assertEquals(HttpStatus.TOO_MANY_REQUESTS, limited.statusCode)
        assertNotNull(limited.responseHeaders?.getFirst(HttpHeaders.RETRY_AFTER))
    }

    @Test
    fun `rate limiting applies before credentials are checked`() {
        repeat(3) { assertThrows { postLogin("nobody@example.com", "wrong-password") } }

        // Correct credentials must not get a free pass: the budget is spent, so
        // the request is rejected before authentication ever runs.
        registerDirectly("real@example.com", "correct-horse-battery")
        val limited = assertThrows { postLogin("real@example.com", "correct-horse-battery") }
        assertEquals(HttpStatus.TOO_MANY_REQUESTS, limited.statusCode)
    }

    @Test
    fun `register has its own budget independent of login`() {
        repeat(3) { assertThrows { postLogin("nobody@example.com", "wrong-password") } }

        // Login is exhausted; register still has its own two attempts.
        postRegister("first@example.com", "correct-horse-battery")
        postRegister("second@example.com", "correct-horse-battery")

        val limited = assertThrows { postRegister("third@example.com", "correct-horse-battery") }
        assertEquals(HttpStatus.TOO_MANY_REQUESTS, limited.statusCode)
    }

    private fun postLogin(email: String, password: String) {
        client.post()
            .uri("/api/auth/login")
            .contentType(MediaType.APPLICATION_JSON)
            .body(mapOf("email" to email, "password" to password))
            .retrieve()
            .toBodilessEntity()
    }

    private fun postRegister(email: String, password: String) {
        client.post()
            .uri("/api/auth/register")
            .contentType(MediaType.APPLICATION_JSON)
            .body(mapOf("email" to email, "password" to password))
            .retrieve()
            .toBodilessEntity()
    }

    /** Creates an account without spending the register budget under test. */
    private fun registerDirectly(email: String, password: String) {
        rateLimiter.reset()
        postRegister(email, password)
        // Restore the exhausted login budget state the caller set up.
        repeat(3) { runCatching { postLogin("nobody@example.com", "wrong-password") } }
    }

    private fun assertThrows(block: () -> Unit): HttpClientErrorException =
        try {
            block()
            throw AssertionError("expected an HTTP error response")
        } catch (ex: HttpClientErrorException) {
            ex
        }
}
