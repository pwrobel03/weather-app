package com.weatherapp.backend.alert

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
import java.time.Instant
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

@Testcontainers
@SpringBootTest
class AlertRepositoryTest {

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
    lateinit var repository: AlertRepository

    @Autowired
    lateinit var jdbcTemplate: JdbcTemplate

    @BeforeEach
    fun setUp() {
        jdbcTemplate.update("TRUNCATE alert CASCADE")
    }

    @Test
    fun `stores a warning with its full area list`() {
        val result = repository.upsert(draft(teryt = listOf("1465", "1261", "3029")))

        assertTrue(result.isNew)
        assertEquals("Gd2026072600001", result.alert.imgwId)
        assertEquals(WarningSeverity.LEVEL_1, result.alert.severity)
        assertEquals(80, result.alert.probabilityPercent)
        assertEquals(listOf("1261", "1465", "3029"), result.alert.terytCodes)
    }

    /**
     * The feed republishes every active warning on every poll. Re-ingesting
     * must not create a second row, and must not read as a new arrival - that
     * is the difference between one notification and one every ten minutes.
     */
    @Test
    fun `re-ingesting the same warning is not a new arrival`() {
        assertTrue(repository.upsert(draft()).isNew)

        val second = repository.upsert(draft())

        assertFalse(second.isNew)
        assertEquals(1, countAlerts())
    }

    /** IMGW amends live warnings in place, keeping the same id. */
    @Test
    fun `a re-publication refreshes mutable fields`() {
        repository.upsert(draft())

        val amended = repository.upsert(
            draft(
                severity = WarningSeverity.LEVEL_2,
                validTo = Instant.parse("2026-07-27T18:00:00Z"),
                content = "Zaostrzono ostrzeżenie.",
            ),
        )

        assertFalse(amended.isNew)
        assertEquals(WarningSeverity.LEVEL_2, amended.alert.severity)
        assertEquals(Instant.parse("2026-07-27T18:00:00Z"), amended.alert.validTo)
        assertEquals("Zaostrzono ostrzeżenie.", amended.alert.content)
        assertEquals(1, countAlerts())
    }

    /**
     * Areas shrink as a system moves through. Merging would leave the warning
     * covering powiats it no longer applies to - and those users would keep
     * being told they are in danger.
     */
    @Test
    fun `a shrinking area replaces the previous one rather than merging`() {
        repository.upsert(draft(teryt = listOf("1465", "1261", "3029")))

        val narrowed = repository.upsert(draft(teryt = listOf("1465")))

        assertEquals(listOf("1465"), narrowed.alert.terytCodes)
    }

    @Test
    fun `tolerates a warning covering no powiats`() {
        val result = repository.upsert(draft(teryt = emptyList()))

        assertTrue(result.alert.terytCodes.isEmpty())
    }

    @Test
    fun `distinct warnings coexist`() {
        repository.upsert(draft(imgwId = "Gd2026072600001"))
        repository.upsert(draft(imgwId = "Wa2026072600002"))

        assertEquals(2, countAlerts())
        assertEquals("Wa2026072600002", repository.findByImgwId("Wa2026072600002")?.imgwId)
    }

    private fun countAlerts(): Long =
        jdbcTemplate.queryForObject("SELECT count(*) FROM alert", Long::class.java)!!

    private fun draft(
        imgwId: String = "Gd2026072600001",
        severity: WarningSeverity = WarningSeverity.LEVEL_1,
        validTo: Instant = Instant.parse("2026-07-27T08:00:00Z"),
        content: String? = "Prognozowane są burze.",
        teryt: List<String> = listOf("1465"),
    ) = AlertDraft(
        imgwId = imgwId,
        event = "Burze",
        severity = severity,
        probabilityPercent = 80,
        validFrom = Instant.parse("2026-07-26T20:00:00Z"),
        validTo = validTo,
        publishedAt = Instant.parse("2026-07-26T10:02:00Z"),
        content = content,
        comment = "Brak.",
        office = "Centralne Biuro Prognoz Meteorologicznych w Warszawie",
        terytCodes = teryt,
    )
}
