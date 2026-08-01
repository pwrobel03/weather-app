package com.weatherapp.backend

import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.testcontainers.containers.GenericContainer
import org.testcontainers.containers.wait.strategy.Wait
import org.testcontainers.junit.jupiter.Container
import org.testcontainers.junit.jupiter.Testcontainers
import java.time.Duration
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
}
