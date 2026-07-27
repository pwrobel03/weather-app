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
import kotlin.test.assertTrue

@Testcontainers
@SpringBootTest
class AlertMatchRepositoryTest {

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
    lateinit var alertRepository: AlertRepository

    @Autowired
    lateinit var matchRepository: AlertMatchRepository

    @Autowired
    lateinit var jdbcTemplate: JdbcTemplate

    @BeforeEach
    fun setUp() {
        jdbcTemplate.update("TRUNCATE alert CASCADE")
        jdbcTemplate.update("TRUNCATE users CASCADE")
    }

    @Test
    fun `matches only locations inside the warned powiats`() {
        val userId = createUser("alice@example.com")
        createLocation(userId, "Warszawa", "1465")
        createLocation(userId, "Kraków", "1261")
        createLocation(userId, "Gdańsk", "2261")

        val alertId = storeAlert(teryt = listOf("1465", "1261"))

        assertEquals(2, matchRepository.recordMatches(alertId))
        assertEquals(listOf("Kraków", "Warszawa"), matchRepository.findMatchedLocationNames(alertId, userId))
    }

    /** The feed republishes active warnings on every poll; that must be a no-op. */
    @Test
    fun `re-running the match records nothing new`() {
        val userId = createUser("alice@example.com")
        createLocation(userId, "Warszawa", "1465")
        val alertId = storeAlert(teryt = listOf("1465"))

        assertEquals(1, matchRepository.recordMatches(alertId))
        assertEquals(0, matchRepository.recordMatches(alertId))
    }

    /** A location saved while a warning is already in force still gets matched. */
    @Test
    fun `a location added later is picked up on the next run`() {
        val userId = createUser("alice@example.com")
        val alertId = storeAlert(teryt = listOf("1465"))
        assertEquals(0, matchRepository.recordMatches(alertId))

        createLocation(userId, "Warszawa", "1465")

        assertEquals(1, matchRepository.recordMatches(alertId))
    }

    /** Locations outside every known boundary carry a NULL code and match nobody. */
    @Test
    fun `locations without a teryt code never match`() {
        val userId = createUser("alice@example.com")
        createLocation(userId, "Paryż", null)

        val alertId = storeAlert(teryt = listOf("1465"))

        assertEquals(0, matchRepository.recordMatches(alertId))
        assertTrue(matchRepository.findMatchedUserIds(alertId).isEmpty())
    }

    @Test
    fun `reports each affected user once regardless of how many locations matched`() {
        val alice = createUser("alice@example.com")
        val bob = createUser("bob@example.com")
        createLocation(alice, "Dom", "1465")
        createLocation(alice, "Praca", "1261")
        createLocation(bob, "Dom", "1465")

        val alertId = storeAlert(teryt = listOf("1465", "1261"))
        matchRepository.recordMatches(alertId)

        assertEquals(listOf(alice, bob), matchRepository.findMatchedUserIds(alertId))
        assertEquals(listOf("Dom", "Praca"), matchRepository.findMatchedLocationNames(alertId, alice))
    }

    /**
     * The realistic shape from the live feed: one storm warning over ~50
     * powiats must reach exactly the users inside them, and nobody else.
     */
    @Test
    fun `a wide warning reaches exactly the users inside it`() {
        val inside = createUser("inside@example.com")
        val outside = createUser("outside@example.com")
        createLocation(inside, "Objęta", "3029")
        createLocation(outside, "Poza", "9999")

        val wideArea = (1..50).map { "%04d".format(it) } + "3029"
        val alertId = storeAlert(teryt = wideArea)
        matchRepository.recordMatches(alertId)

        assertEquals(listOf(inside), matchRepository.findMatchedUserIds(alertId))
    }

    /**
     * The gap the Faza 7 checkpoint exposed: someone saving a location while a
     * warning is already running saw nothing until the next ingest.
     */
    @Test
    fun `a location saved during a warning matches it immediately`() {
        val userId = createUser("alice@example.com")
        val alertId = storeAlert(teryt = listOf("3029"))
        matchRepository.recordMatches(alertId)

        createLocation(userId, "Dom", "3029")
        val locationId = jdbcTemplate.queryForObject(
            "SELECT id FROM saved_location WHERE user_id = ?",
            Long::class.java,
            userId,
        )!!

        assertEquals(1, matchRepository.recordMatchesForLocation(locationId))
        assertEquals(listOf(userId), matchRepository.findMatchedUserIds(alertId))
    }

    /** An expired warning is history; recording it now would put it on the
     * location's timeline as though it had always been relevant there. */
    @Test
    fun `an expired warning is not matched to a newly saved location`() {
        val userId = createUser("alice@example.com")
        storeAlert(
            teryt = listOf("3029"),
            validFrom = Instant.now().minus(Duration.ofDays(2)),
            validTo = Instant.now().minus(Duration.ofHours(3)),
        )

        createLocation(userId, "Dom", "3029")
        val locationId = jdbcTemplate.queryForObject(
            "SELECT id FROM saved_location WHERE user_id = ?",
            Long::class.java,
            userId,
        )!!

        assertEquals(0, matchRepository.recordMatchesForLocation(locationId))
    }

    private fun createUser(email: String): Long =
        jdbcTemplate.queryForObject(
            "INSERT INTO users (email, password_hash) VALUES (?, ?) RETURNING id",
            Long::class.java,
            email,
            "irrelevant-hash",
        )!!

    private fun createLocation(userId: Long, name: String, terytCode: String?) {
        jdbcTemplate.update(
            "INSERT INTO saved_location (user_id, name, latitude, longitude, teryt_code) VALUES (?, ?, ?, ?, ?)",
            userId,
            name,
            // Coordinates only need to be unique per user here - matching runs
            // off teryt_code, which is precomputed at save time.
            name.hashCode() % 90 / 1.0,
            name.hashCode() % 180 / 1.0,
            terytCode,
        )
    }

    private fun storeAlert(
        teryt: List<String>,
        validFrom: Instant = Instant.parse("2026-07-26T20:00:00Z"),
        validTo: Instant = Instant.now().plus(Duration.ofHours(8)),
    ): Long =
        alertRepository.upsert(
            AlertDraft(
                imgwId = "Gd2026072600001",
                event = "Burze",
                severity = WarningSeverity.LEVEL_1,
                probabilityPercent = 80,
                validFrom = validFrom,
                validTo = validTo,
                publishedAt = Instant.parse("2026-07-26T10:02:00Z"),
                content = "Prognozowane są burze.",
                comment = null,
                office = null,
                terytCodes = teryt,
            ),
        ).alert.id
}
