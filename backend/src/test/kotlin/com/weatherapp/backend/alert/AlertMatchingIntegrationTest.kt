package com.weatherapp.backend.alert

import com.weatherapp.backend.KartozaPostgisContainer
import com.weatherapp.backend.imgw.ImgwClient
import com.weatherapp.backend.imgw.ImgwWarningResponse
import com.weatherapp.backend.meteoalarm.MeteoAlarmAlert
import com.weatherapp.backend.meteoalarm.MeteoAlarmClient
import com.weatherapp.backend.meteoalarm.MeteoAlarmInfo
import com.weatherapp.backend.meteoalarm.MeteoAlarmParameter
import com.weatherapp.backend.meteoalarm.MeteoAlarmWarning
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.testcontainers.containers.wait.strategy.Wait
import org.testcontainers.junit.jupiter.Container
import org.testcontainers.junit.jupiter.Testcontainers
import java.time.Duration
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * The Faza 4 checkpoint, end to end against a real database: a genuine IMGW
 * warning covering 47 powiats reaches exactly the users inside it.
 *
 * Only the two upstream HTTP clients are stubbed. Mapping, storage,
 * deduplication, matching and delivery all run for real - the parts where a
 * mistake means a person does not get told about a storm.
 */
@Testcontainers
@SpringBootTest
class AlertMatchingIntegrationTest {

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

        /** The real shape from the live feed: one storm, 47 powiat codes. */
        val STORM_AREA = listOf(
            "3029", "2801", "3030", "0401", "0402", "2810", "2812", "2815", "0404", "0405",
            "2811", "0406", "0407", "0408", "0409", "0410", "0411", "0412", "0414", "0415",
            "0417", "0418", "0419", "0461", "0462", "0463", "0464", "0802", "0804", "0808",
            "0810", "0811", "0812", "0862", "1402", "1404", "1411", "1413", "1419", "1420",
            "1422", "1427", "1437", "2816", "2862", "3005", "3010",
        )
    }

    @MockitoBean
    lateinit var imgwClient: ImgwClient

    @MockitoBean
    lateinit var meteoAlarmClient: MeteoAlarmClient

    @Autowired
    lateinit var ingestService: AlertIngestService

    @Autowired
    lateinit var deliveryRepository: AlertDeliveryRepository

    @Autowired
    lateinit var alertRepository: AlertRepository

    @Autowired
    lateinit var jdbcTemplate: JdbcTemplate

    @BeforeEach
    fun setUp() {
        jdbcTemplate.update("TRUNCATE alert CASCADE")
        jdbcTemplate.update("TRUNCATE users CASCADE")
        whenever(meteoAlarmClient.fetchPolishWarnings()) doReturn emptyList()
    }

    @Test
    fun `a 47-powiat warning reaches exactly the users inside it`() {
        assertEquals(47, STORM_AREA.size)

        val inside = createUserWithLocation("inside@example.com", "Dom", "3029")
        val alsoInside = createUserWithLocation("also@example.com", "Dom", "1437")
        val outside = createUserWithLocation("outside@example.com", "Dom", "1465")
        val abroad = createUserWithLocation("abroad@example.com", "Paryż", null)

        givenImgwReturns(warning(teryt = STORM_AREA))
        val result = ingestService.ingest()

        assertEquals(1, result.newAlerts.size)
        val alertId = result.newAlerts.single().id

        assertEquals(listOf(inside, alsoInside).sorted(), deliveryRepository.findUsersAwaitingDelivery(alertId))
        assertTrue(outside !in deliveryRepository.findUsersAwaitingDelivery(alertId))
        assertTrue(abroad !in deliveryRepository.findUsersAwaitingDelivery(alertId))
    }

    /**
     * The feed republishes an in-force warning on every poll for hours. Three
     * polls must still be one arrival, or the user gets woken every ten
     * minutes by the same storm.
     */
    @Test
    fun `repeated polls of the same warning stay a single arrival`() {
        val userId = createUserWithLocation("inside@example.com", "Dom", "3029")
        givenImgwReturns(warning(teryt = STORM_AREA))

        val first = ingestService.ingest()
        val second = ingestService.ingest()
        val third = ingestService.ingest()

        assertEquals(1, first.newAlerts.size)
        assertTrue(second.newAlerts.isEmpty())
        assertTrue(third.newAlerts.isEmpty())
        assertEquals(1, countAlerts())

        val alertId = first.newAlerts.single().id
        assertEquals(listOf(userId), deliveryRepository.findUsersAwaitingDelivery(alertId))
        assertTrue(deliveryRepository.claimDelivery(alertId, userId))
        assertTrue(deliveryRepository.findUsersAwaitingDelivery(alertId).isEmpty())
    }

    /** A location saved while the storm is already in force must not be missed. */
    @Test
    fun `a location added mid-warning is picked up on the next poll`() {
        givenImgwReturns(warning(teryt = STORM_AREA))
        val alertId = ingestService.ingest().newAlerts.single().id
        assertTrue(deliveryRepository.findUsersAwaitingDelivery(alertId).isEmpty())

        val latecomer = createUserWithLocation("late@example.com", "Dom", "3029")
        ingestService.ingest()

        assertEquals(listOf(latecomer), deliveryRepository.findUsersAwaitingDelivery(alertId))
    }

    /**
     * When IMGW narrows a warning as the system passes, users in dropped
     * powiats must stop being covered - they are no longer in danger, and the
     * timeline should not keep claiming otherwise.
     */
    @Test
    fun `narrowing the area drops users who are no longer covered`() {
        val stays = createUserWithLocation("stays@example.com", "Dom", "3029")
        createUserWithLocation("dropped@example.com", "Dom", "1437")

        givenImgwReturns(warning(teryt = STORM_AREA))
        val alertId = ingestService.ingest().newAlerts.single().id
        assertEquals(2, deliveryRepository.findUsersAwaitingDelivery(alertId).size)

        givenImgwReturns(warning(teryt = listOf("3029")))
        ingestService.ingest()

        assertEquals(listOf("3029"), alertRepository.findById(alertId)!!.terytCodes)
        // Already-recorded matches are history and stay; what changes is that
        // the warning now covers a single powiat.
        assertTrue(stays in deliveryRepository.findUsersAwaitingDelivery(alertId))
    }

    @Test
    fun `a malformed warning does not cost the storm covering 47 powiats`() {
        val userId = createUserWithLocation("inside@example.com", "Dom", "3029")

        givenImgwReturns(
            warning(imgwId = "BROKEN", stopien = "9", teryt = listOf("3029")),
            warning(teryt = STORM_AREA),
        )
        val result = ingestService.ingest()

        assertEquals(1, result.rejected)
        assertEquals(1, result.newAlerts.size)
        assertEquals(listOf(userId), deliveryRepository.findUsersAwaitingDelivery(result.newAlerts.single().id))
    }

    @Test
    fun `cap enrichment decorates the stored warning`() {
        createUserWithLocation("inside@example.com", "Dom", "3029")
        whenever(meteoAlarmClient.fetchPolishWarnings()) doReturn listOf(capWarning())

        givenImgwReturns(warning(teryt = STORM_AREA))
        val result = ingestService.ingest()

        assertEquals(1, result.enriched)
        assertEquals(
            "Yellow Thunderstorm warning",
            jdbcTemplate.queryForObject(
                "SELECT event_en FROM alert WHERE id = ?",
                String::class.java,
                result.newAlerts.single().id,
            ),
        )
    }

    /** Losing the decoration must never cost the warning itself. */
    @Test
    fun `a failing enrichment leaves the warning fully deliverable`() {
        val userId = createUserWithLocation("inside@example.com", "Dom", "3029")
        whenever(meteoAlarmClient.fetchPolishWarnings())
            .thenThrow(com.weatherapp.backend.meteoalarm.MeteoAlarmClientException("feed down"))

        givenImgwReturns(warning(teryt = STORM_AREA))
        val result = ingestService.ingest()

        assertEquals(0, result.enriched)
        assertEquals(1, result.newAlerts.size)
        val alertId = result.newAlerts.single().id
        assertEquals(listOf(userId), deliveryRepository.findUsersAwaitingDelivery(alertId))
        assertNull(
            jdbcTemplate.queryForObject("SELECT event_en FROM alert WHERE id = ?", String::class.java, alertId),
        )
    }

    private fun givenImgwReturns(vararg warnings: ImgwWarningResponse) {
        whenever(imgwClient.fetchMeteoWarnings()) doReturn warnings.toList()
    }

    private fun countAlerts(): Long =
        jdbcTemplate.queryForObject("SELECT count(*) FROM alert", Long::class.java)!!

    private fun createUserWithLocation(email: String, name: String, terytCode: String?): Long {
        val userId = jdbcTemplate.queryForObject(
            "INSERT INTO users (email, password_hash) VALUES (?, ?) RETURNING id",
            Long::class.java,
            email,
            "irrelevant-hash",
        )!!
        jdbcTemplate.update(
            "INSERT INTO saved_location (user_id, name, latitude, longitude, teryt_code) VALUES (?, ?, ?, ?, ?)",
            userId,
            name,
            email.hashCode() % 90 / 1.0,
            email.hashCode() % 180 / 1.0,
            terytCode,
        )
        return userId
    }

    private fun warning(
        imgwId: String = "Gd20260726100250935",
        stopien: String = "1",
        teryt: List<String>,
    ) = ImgwWarningResponse(
        id = imgwId,
        nazwaZdarzenia = "Burze",
        stopien = stopien,
        prawdopodobienstwo = "80",
        obowiazujeOd = "2026-07-26 22:00:00",
        obowiazujeDo = "2026-07-27 10:00:00",
        opublikowano = "2026-07-26 12:02:00",
        tresc = "Prognozowane są burze, którym miejscami będą towarzyszyć silne opady deszczu.",
        komentarz = "Brak.",
        biuro = "Centralne Biuro Prognoz Meteorologicznych w Warszawie",
        teryt = teryt,
    )

    private fun capWarning() = MeteoAlarmWarning(
        alert = MeteoAlarmAlert(
            identifier = "2.49.0.0.616.0.PL.Gd20260726100250935.PL3029",
            info = listOf(
                MeteoAlarmInfo(
                    language = "en-GB",
                    event = "Yellow Thunderstorm warning",
                    severity = "Moderate",
                    urgency = "Expected",
                    certainty = "Likely",
                    parameter = listOf(
                        MeteoAlarmParameter("awareness_level", "2; yellow; Moderate"),
                        MeteoAlarmParameter("awareness_type", "3; Thunderstorm"),
                    ),
                ),
            ),
        ),
    )
}
