package com.weatherapp.backend.boundary

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
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * Real TERYT codes/names/voivodeships below are verified against the live
 * PRG GUGiK WFS (see commit 22 / markdown/progress-log.md) — only the
 * boundary geometry is synthetic (small squares around each city's real
 * coordinates), so tests stay fast and don't depend on network access.
 */
@Testcontainers
@SpringBootTest
class PowiatBoundaryRepositoryTest {

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

        private const val HALF_EDGE_DEGREES = 0.02
    }

    @Autowired
    lateinit var jdbcTemplate: JdbcTemplate

    @Autowired
    lateinit var repository: PowiatBoundaryRepository

    @BeforeEach
    fun seedKnownPowiats() {
        jdbcTemplate.update("TRUNCATE powiat_boundary")
        insertSquareAround("1465", "powiat Warszawa", "mazowieckie", longitude = 21.0122, latitude = 52.2297)
        insertSquareAround("1261", "powiat Kraków", "małopolskie", longitude = 19.9450, latitude = 50.0647)
        insertSquareAround("1421", "powiat pruszkowski", "mazowieckie", longitude = 20.8006, latitude = 52.1652)
    }

    private fun insertSquareAround(teryt: String, name: String, voivodeship: String, longitude: Double, latitude: Double) {
        val minLon = longitude - HALF_EDGE_DEGREES
        val maxLon = longitude + HALF_EDGE_DEGREES
        val minLat = latitude - HALF_EDGE_DEGREES
        val maxLat = latitude + HALF_EDGE_DEGREES
        jdbcTemplate.update(
            """
            INSERT INTO powiat_boundary (teryt_code, name, voivodeship, boundary)
            VALUES (?, ?, ?, ST_GeogFromText(?))
            """.trimIndent(),
            teryt,
            name,
            voivodeship,
            "MULTIPOLYGON((($minLon $minLat, $minLon $maxLat, $maxLon $maxLat, $maxLon $minLat, $minLon $minLat)))",
        )
    }

    @Test
    fun `resolves a point inside Warszawa, a miasto na prawach powiatu`() {
        val result = repository.findContainingPoint(latitude = 52.2297, longitude = 21.0122)

        assertEquals(PowiatBoundary("1465", "powiat Warszawa", "mazowieckie"), result)
    }

    @Test
    fun `resolves a point inside Krakow, a miasto na prawach powiatu`() {
        val result = repository.findContainingPoint(latitude = 50.0647, longitude = 19.9450)

        assertEquals(PowiatBoundary("1261", "powiat Kraków", "małopolskie"), result)
    }

    @Test
    fun `resolves a point inside a regular ziemski powiat`() {
        val result = repository.findContainingPoint(latitude = 52.1652, longitude = 20.8006)

        assertEquals(PowiatBoundary("1421", "powiat pruszkowski", "mazowieckie"), result)
    }

    @Test
    fun `returns null for a point outside all known boundaries`() {
        val result = repository.findContainingPoint(latitude = 0.0, longitude = 0.0)

        assertNull(result)
    }

    @Test
    fun `returns a simplified geojson feature for a known teryt code`() {
        val feature = repository.findSimplifiedGeoJson("1465")

        requireNotNull(feature)
        assertEquals("Feature", feature.type)
        assertEquals(PowiatGeoJsonFeature.Properties("1465", "powiat Warszawa", "mazowieckie"), feature.properties)
        assertTrue(feature.geometry.contains("\"type\":\"MultiPolygon\""))
    }

    @Test
    fun `returns geojson for several teryt codes in one query`() {
        val features = repository.findSimplifiedGeoJson(listOf("1465", "1261"))

        assertEquals(listOf("1261", "1465"), features.map { it.properties.terytCode })
        assertTrue(features.all { it.geometry.contains("\"type\":\"MultiPolygon\"") })
    }

    @Test
    fun `skips unknown codes in a batch instead of failing the whole request`() {
        // One powiat missing from the import should leave that shape unpainted,
        // not blank the map for the other hundred the warning covers.
        val features = repository.findSimplifiedGeoJson(listOf("1465", "9999"))

        assertEquals(listOf("1465"), features.map { it.properties.terytCode })
    }

    @Test
    fun `returns nothing for an empty batch without touching the database`() {
        // The IN () that a naive implementation builds here is a syntax error
        // in Postgres, so this is a crash rather than an empty result.
        assertEquals(emptyList(), repository.findSimplifiedGeoJson(emptyList()))
    }

    @Test
    fun `returns null geojson for an unknown teryt code`() {
        val feature = repository.findSimplifiedGeoJson("9999")

        assertNull(feature)
    }
}
