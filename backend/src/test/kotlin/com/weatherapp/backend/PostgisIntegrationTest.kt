package com.weatherapp.backend

import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.testcontainers.containers.GenericContainer
import org.testcontainers.containers.wait.strategy.Wait
import org.springframework.dao.DataIntegrityViolationException
import org.testcontainers.junit.jupiter.Container
import org.testcontainers.junit.jupiter.Testcontainers
import java.time.Duration
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

/**
 * kartoza/postgis ships a custom entrypoint (init dance + restart into foreground).
 * Testcontainers' own PostgreSQLContainer overrides the container command to
 * `postgres -c fsync=off`, which bypasses that entrypoint entirely and makes the
 * container exit immediately - so this uses a plain GenericContainer instead,
 * letting the image's own ENTRYPOINT/CMD run unmodified.
 */
class KartozaPostgisContainer(image: String) : GenericContainer<KartozaPostgisContainer>(image)

@Testcontainers
@SpringBootTest
class PostgisIntegrationTest {

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

    @Test
    fun `postgis is available and ST_Intersects works`() {
        val result = jdbcTemplate.queryForObject(
            "SELECT ST_Intersects(ST_MakeEnvelope(0,0,10,10,4326), ST_MakeEnvelope(5,5,15,15,4326))",
            Boolean::class.java,
        )
        assertTrue(result == true)
    }

    @Test
    fun `powiat_boundary table stores geography and is indexed with gist`() {
        val insertedId = jdbcTemplate.queryForObject(
            """
            INSERT INTO powiat_boundary (teryt_code, name, voivodeship, boundary)
            VALUES ('1465', 'Warszawa', 'mazowieckie', ST_GeogFromText('MULTIPOLYGON(((0 0, 0 1, 1 1, 1 0, 0 0)))'))
            RETURNING id
            """.trimIndent(),
            Long::class.java,
        )
        assertTrue(insertedId != null && insertedId > 0)

        val hasGistIndex = jdbcTemplate.queryForObject(
            "SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'powiat_boundary' AND indexdef ILIKE '%USING gist%')",
            Boolean::class.java,
        )
        assertTrue(hasGistIndex == true)

        val containsPoint = jdbcTemplate.queryForObject(
            "SELECT ST_Contains(boundary::geometry, ST_SetSRID(ST_MakePoint(0.5, 0.5), 4326)) FROM powiat_boundary WHERE id = ?",
            Boolean::class.java,
            insertedId,
        )
        assertTrue(containsPoint == true)
    }

    @Test
    fun `saved_location is indexed by teryt_code for alert matching`() {
        val hasTerytIndex = jdbcTemplate.queryForObject(
            """
            SELECT EXISTS (
                SELECT 1 FROM pg_indexes
                WHERE tablename = 'saved_location' AND indexdef ILIKE '%(teryt_code)%'
            )
            """.trimIndent(),
            Boolean::class.java,
        )
        assertTrue(hasTerytIndex == true)
    }

    @Test
    fun `saved_location cascades on user delete and rejects duplicate coordinates per user`() {
        val userId = jdbcTemplate.queryForObject(
            "INSERT INTO users (email, password_hash) VALUES (?, ?) RETURNING id",
            Long::class.java,
            "cascade-test@example.com",
            "irrelevant-hash",
        )

        jdbcTemplate.update(
            "INSERT INTO saved_location (user_id, name, latitude, longitude) VALUES (?, ?, ?, ?)",
            userId,
            "Dom",
            52.23,
            21.01,
        )

        assertFailsWith<DataIntegrityViolationException> {
            jdbcTemplate.update(
                "INSERT INTO saved_location (user_id, name, latitude, longitude) VALUES (?, ?, ?, ?)",
                userId,
                "Duplikat",
                52.23,
                21.01,
            )
        }

        jdbcTemplate.update("DELETE FROM users WHERE id = ?", userId)

        val remaining = jdbcTemplate.queryForObject(
            "SELECT count(*) FROM saved_location WHERE user_id = ?",
            Long::class.java,
            userId,
        )
        assertEquals(0L, remaining)
    }
}
