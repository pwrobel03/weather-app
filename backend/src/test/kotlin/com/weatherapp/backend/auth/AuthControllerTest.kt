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
    fun `starts an anonymous session without any credentials`() {
        val tokens = anonymous()

        assertNotEquals("", tokens.accessToken)
        assertNotEquals("", tokens.refreshToken)
        assertEquals(1, jdbcTemplate.queryForObject("SELECT count(*) FROM users", Int::class.java))
    }

    @Test
    fun `gives every anonymous device a user of its own`() {
        // Two installs are two users, or one device's saved places and warnings
        // would show up on another's.
        val first = anonymous()
        val second = anonymous()

        assertNotEquals(first.refreshToken, second.refreshToken)
        assertEquals(2, jdbcTemplate.queryForObject("SELECT count(*) FROM users", Int::class.java))
    }

    @Test
    fun `leaves an anonymous user without credentials`() {
        anonymous()

        val row = jdbcTemplate.queryForMap("SELECT email, password_hash, role FROM users")
        assertEquals(null, row["email"])
        assertEquals(null, row["password_hash"])
        // Anonymous is about credentials, not privileges - the role is the
        // ordinary one, so nothing downstream needs to special-case it.
        assertEquals("USER", row["role"])
    }

    @Test
    fun `an anonymous session refreshes like any other`() {
        val tokens = anonymous()

        val refreshed = refresh(tokens.refreshToken)

        assertNotEquals(tokens.refreshToken, refreshed.refreshToken)
    }

    @Test
    fun `refuses a user that is half registered`() {
        // The schema, not the service, is the last line here: an email without
        // a password hash would be an account nobody can authenticate as, and
        // a hash without an email one nobody can reach.
        val exception = assertThrows<Exception> {
            jdbcTemplate.update("INSERT INTO users (email) VALUES ('half@example.com')")
        }

        assertEquals(true, exception.message?.contains("users_credentials_complete"))
    }

    @Test
    fun `registering from an anonymous session keeps the same user`() {
        val device = anonymous()
        val userId = jdbcTemplate.queryForObject("SELECT id FROM users", Long::class.java)

        registerAs(device.accessToken, "erin@example.com", "correct-horse-battery")

        // One user, not two - which is the entire point: whatever this device
        // saved before signing up already hangs off this id.
        assertEquals(1, jdbcTemplate.queryForObject("SELECT count(*) FROM users", Int::class.java))
        assertEquals(
            userId,
            jdbcTemplate.queryForObject("SELECT id FROM users WHERE email = 'erin@example.com'", Long::class.java),
        )
    }

    @Test
    fun `a place saved anonymously survives registration`() {
        val device = anonymous()
        val userId = jdbcTemplate.queryForObject("SELECT id FROM users", Long::class.java)!!
        jdbcTemplate.update(
            "INSERT INTO saved_location (user_id, name, latitude, longitude) VALUES (?, 'Kraków', 50.06, 19.94)",
            userId,
        )

        registerAs(device.accessToken, "frank@example.com", "correct-horse-battery")

        assertEquals(
            "Kraków",
            jdbcTemplate.queryForObject(
                "SELECT name FROM saved_location WHERE user_id = ?",
                String::class.java,
                userId,
            ),
        )
    }

    @Test
    fun `the anonymous session's own tokens still work after registering`() {
        // The id did not change, so a client that registers mid-session is not
        // logged out of the requests already in flight.
        val device = anonymous()

        registerAs(device.accessToken, "grace@example.com", "correct-horse-battery")

        val refreshed = refresh(device.refreshToken)
        assertNotEquals("", refreshed.accessToken)
    }

    @Test
    fun `refuses to register a session that already has credentials`() {
        val account = register("heidi@example.com", "correct-horse-battery")

        val exception = assertThrows<HttpClientErrorException> {
            registerAs(account.accessToken, "heidi-second@example.com", "correct-horse-battery")
        }

        assertEquals(409, exception.statusCode.value())
    }

    @Test
    fun `refuses to promote onto an email somebody else already uses`() {
        register("ivan@example.com", "correct-horse-battery")
        val device = anonymous()

        val exception = assertThrows<HttpClientErrorException> {
            registerAs(device.accessToken, "ivan@example.com", "another-password-here")
        }

        assertEquals(409, exception.statusCode.value())
        // The failed attempt must leave the device anonymous and usable, not
        // half-written.
        assertEquals(
            1,
            jdbcTemplate.queryForObject("SELECT count(*) FROM users WHERE email IS NULL", Int::class.java),
        )
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

    private fun anonymous(): AuthResponse {
        val json = client.post()
            .uri("/api/auth/anonymous")
            .retrieve()
            .body(String::class.java)!!
        return objectMapper.readValue<AuthResponse>(json)
    }

    private fun register(email: String, password: String): AuthResponse =
        post("/api/auth/register", mapOf("email" to email, "password" to password))

    /** Registration carrying a session, which is how a device signs up. */
    private fun registerAs(accessToken: String, email: String, password: String): AuthResponse {
        val json = client.post()
            .uri("/api/auth/register")
            .contentType(MediaType.APPLICATION_JSON)
            .header("Authorization", "Bearer $accessToken")
            .body(mapOf("email" to email, "password" to password))
            .retrieve()
            .body(String::class.java)!!
        return objectMapper.readValue<AuthResponse>(json)
    }

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
