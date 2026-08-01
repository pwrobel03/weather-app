package com.weatherapp.backend.user

import com.weatherapp.backend.KartozaPostgisContainer
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.testcontainers.containers.wait.strategy.Wait
import org.testcontainers.junit.jupiter.Container
import org.testcontainers.junit.jupiter.Testcontainers
import java.time.Duration
import kotlin.test.assertEquals

/**
 * The sweep collects anonymous users nothing can authenticate as any more.
 *
 * The cases worth writing are the ones where deleting would destroy live data:
 * a device still inside its refresh window, and a registered account whose
 * tokens have all lapsed but who can simply log in again.
 */
@Testcontainers
@SpringBootTest(properties = ["anonymous-cleanup.enabled=false"])
class AnonymousCleanupServiceTest {

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

    @Autowired
    lateinit var jdbcTemplate: JdbcTemplate

    @Autowired
    lateinit var service: AnonymousCleanupService

    @BeforeEach
    fun setUp() {
        jdbcTemplate.update("TRUNCATE users CASCADE")
    }

    @Test
    fun `collects an anonymous user whose refresh token has expired`() {
        val id = anonymousUser()
        refreshToken(id, "expired-hash", expiresInDays = -1)

        assertEquals(1, service.sweep())
        assertEquals(0, countUsers())
    }

    @Test
    fun `collects an anonymous user whose refresh token was revoked`() {
        val id = anonymousUser()
        refreshToken(id, "revoked-hash", expiresInDays = 30, revoked = true)

        assertEquals(1, service.sweep())
        assertEquals(0, countUsers())
    }

    @Test
    fun `collects an anonymous user that never got a token at all`() {
        anonymousUser()

        assertEquals(1, service.sweep())
        assertEquals(0, countUsers())
    }

    @Test
    fun `spares a device still inside its refresh window`() {
        val id = anonymousUser()
        refreshToken(id, "live-hash", expiresInDays = 30)

        assertEquals(0, service.sweep())
        assertEquals(1, countUsers())
    }

    @Test
    fun `spares a registered account no matter how stale its tokens are`() {
        // The distinguishing fact is the password, not the token: this user can
        // log in and mint a new one, so the row is reachable.
        val id = registeredUser()
        refreshToken(id, "long-expired-hash", expiresInDays = -90)

        assertEquals(0, service.sweep())
        assertEquals(1, countUsers())
    }

    @Test
    fun `takes the anonymous user's saved places with it`() {
        val id = anonymousUser()
        jdbcTemplate.update(
            "INSERT INTO saved_location (user_id, name, latitude, longitude) VALUES (?, 'Kraków', 50.06, 19.94)",
            id,
        )

        service.sweep()

        // Cascade, not a second statement - a place belonging to no user would
        // outlive every way of reading it.
        assertEquals(0, jdbcTemplate.queryForObject("SELECT count(*) FROM saved_location", Int::class.java))
    }

    private fun anonymousUser(): Long =
        jdbcTemplate.queryForObject("INSERT INTO users DEFAULT VALUES RETURNING id", Long::class.java)!!

    private fun registeredUser(): Long =
        jdbcTemplate.queryForObject(
            "INSERT INTO users (email, password_hash) VALUES ('someone@example.com', 'hash') RETURNING id",
            Long::class.java,
        )!!

    private fun refreshToken(userId: Long, hash: String, expiresInDays: Long, revoked: Boolean = false) {
        jdbcTemplate.update(
            """
            INSERT INTO refresh_token (user_id, token_hash, expires_at, revoked_at)
            VALUES (?, ?, now() + make_interval(days => ?), ?)
            """.trimIndent(),
            userId,
            hash,
            expiresInDays.toInt(),
            if (revoked) java.sql.Timestamp.from(java.time.Instant.now()) else null,
        )
    }

    private fun countUsers(): Int =
        jdbcTemplate.queryForObject("SELECT count(*) FROM users", Int::class.java)!!
}
