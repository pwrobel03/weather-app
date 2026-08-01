package com.weatherapp.backend.realtime

import com.weatherapp.backend.KartozaPostgisContainer
import com.weatherapp.backend.alert.AlertDeliveryRepository
import com.weatherapp.backend.alert.AlertDraft
import com.weatherapp.backend.alert.AlertMatchRepository
import com.weatherapp.backend.alert.AlertRepository
import com.weatherapp.backend.alert.WarningSeverity
import com.weatherapp.backend.user.UserPushTokenRepository
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
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
import java.time.Instant
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/**
 * A delivery claim is a promise to tell someone about a storm. These pin down
 * what happens when that promise cannot be kept.
 */
@Testcontainers
@SpringBootTest
class AlertDeliveryReleaseTest {

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

    @MockitoBean
    lateinit var expoPushClient: ExpoPushClient

    @Autowired
    lateinit var dispatcher: AlertRealtimeDispatcher

    @Autowired
    lateinit var alertRepository: AlertRepository

    @Autowired
    lateinit var matchRepository: AlertMatchRepository

    @Autowired
    lateinit var deliveryRepository: AlertDeliveryRepository

    @Autowired
    lateinit var pushTokenRepository: UserPushTokenRepository

    @Autowired
    lateinit var jdbcTemplate: JdbcTemplate

    @BeforeEach
    fun setUp() {
        jdbcTemplate.update("TRUNCATE alert CASCADE")
        jdbcTemplate.update("TRUNCATE users CASCADE")
    }

    /**
     * The regression this guards: claiming before sending meant a failed relay
     * marked the user as told, and findUsersAwaitingDelivery never offered the
     * alert again. A silent, permanent loss of a storm warning.
     */
    @Test
    fun `a failed push release the claim so the alert is retried`() {
        whenever(expoPushClient.sendPushNotifications(any())) doReturn false
        val userId = userWithLocation("alice@example.com", "3029")
        pushTokenRepository.upsert(userId, "ExponentPushToken[abc]")
        val alert = storeAndMatch()

        dispatcher.dispatch(listOf(alert))

        assertFalse(deliveryRepository.hasBeenDelivered(alert.id, userId))
        assertEquals(listOf(userId), deliveryRepository.findUsersAwaitingDelivery(alert.id))
    }

    @Test
    fun `a successful push keeps the claim so it is not sent twice`() {
        whenever(expoPushClient.sendPushNotifications(any())) doReturn true
        val userId = userWithLocation("alice@example.com", "3029")
        pushTokenRepository.upsert(userId, "ExponentPushToken[abc]")
        val alert = storeAndMatch()

        dispatcher.dispatch(listOf(alert))

        assertTrue(deliveryRepository.hasBeenDelivered(alert.id, userId))
        assertTrue(deliveryRepository.findUsersAwaitingDelivery(alert.id).isEmpty())
    }

    /** No socket and no push token is not a failure - there is simply nobody to tell yet. */
    @Test
    fun `an unreachable user keeps awaiting delivery without a claim`() {
        val userId = userWithLocation("alice@example.com", "3029")
        val alert = storeAndMatch()

        dispatcher.dispatch(listOf(alert))

        assertFalse(deliveryRepository.hasBeenDelivered(alert.id, userId))
        assertEquals(listOf(userId), deliveryRepository.findUsersAwaitingDelivery(alert.id))
    }

    @Test
    fun `releasing a claim is idempotent`() {
        val userId = userWithLocation("alice@example.com", "3029")
        val alert = storeAndMatch()

        assertTrue(deliveryRepository.claimDelivery(alert.id, userId))
        assertTrue(deliveryRepository.releaseDelivery(alert.id, userId))
        assertFalse(deliveryRepository.releaseDelivery(alert.id, userId))
        assertTrue(deliveryRepository.claimDelivery(alert.id, userId))
    }

    private fun userWithLocation(email: String, terytCode: String): Long {
        val userId = jdbcTemplate.queryForObject(
            "INSERT INTO users (email, password_hash) VALUES (?, ?) RETURNING id",
            Long::class.java,
            email,
            "irrelevant-hash",
        )!!
        jdbcTemplate.update(
            "INSERT INTO saved_location (user_id, name, latitude, longitude, teryt_code) VALUES (?, ?, ?, ?, ?)",
            userId,
            "Dom",
            52.23,
            21.01,
            terytCode,
        )
        return userId
    }

    private fun storeAndMatch(): com.weatherapp.backend.alert.Alert {
        val alert = alertRepository.upsert(
            AlertDraft(
                imgwId = "Gd2026072600001",
                event = "Burze",
                severity = WarningSeverity.LEVEL_1,
                probabilityPercent = 80,
                validFrom = Instant.now().minus(Duration.ofHours(1)),
                validTo = Instant.now().plus(Duration.ofHours(8)),
                publishedAt = Instant.now().minus(Duration.ofHours(2)),
                content = "Prognozowane są burze.",
                comment = null,
                office = null,
                terytCodes = listOf("3029"),
            ),
        ).alert
        matchRepository.recordMatches(alert.id)
        return alert
    }
}
