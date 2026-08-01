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
import java.util.concurrent.Callable
import java.util.concurrent.Executors
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

@Testcontainers
@SpringBootTest
class AlertDeliveryRepositoryTest {

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
    lateinit var deliveryRepository: AlertDeliveryRepository

    @Autowired
    lateinit var jdbcTemplate: JdbcTemplate

    @BeforeEach
    fun setUp() {
        jdbcTemplate.update("TRUNCATE alert CASCADE")
        jdbcTemplate.update("TRUNCATE users CASCADE")
    }

    @Test
    fun `a claimed delivery has no channel until one carried it`() {
        // The null is a state, not a gap: the claim reserves the right to
        // notify before anything is attempted, and only the attempt knows how
        // it went out. A row still null afterwards is a process that died in
        // between - rare, and worth being able to count.
        val userId = createUser("alice@example.com")
        val alertId = storeAlert()

        deliveryRepository.claimDelivery(alertId, userId)

        assertNull(channelOf(alertId, userId))
    }

    @Test
    fun `confirming records which channel carried it`() {
        val userId = createUser("alice@example.com")
        val alertId = storeAlert()
        deliveryRepository.claimDelivery(alertId, userId)

        assertTrue(deliveryRepository.confirmDelivery(alertId, userId, DeliveryChannel.PUSH))

        assertEquals("push", channelOf(alertId, userId))
    }

    @Test
    fun `the two channels are told apart`() {
        // The reason the column exists: push is the one that wakes somebody at
        // 3am, and "delivery looks healthy" is not a useful statement if all of
        // it turns out to be the socket.
        val userId = createUser("alice@example.com")
        val socketAlert = storeAlert(imgwId = "Gd2026072600001")
        val pushAlert = storeAlert(imgwId = "Gd2026072600002")

        deliveryRepository.claimDelivery(socketAlert, userId)
        deliveryRepository.confirmDelivery(socketAlert, userId, DeliveryChannel.WEBSOCKET)
        deliveryRepository.claimDelivery(pushAlert, userId)
        deliveryRepository.confirmDelivery(pushAlert, userId, DeliveryChannel.PUSH)

        assertEquals("websocket", channelOf(socketAlert, userId))
        assertEquals("push", channelOf(pushAlert, userId))
    }

    @Test
    fun `confirming a delivery nobody claimed changes nothing`() {
        // Guards the ordering the dispatcher relies on. If this quietly
        // inserted a row, a failed send followed by a stray confirm would
        // resurrect a claim that had been deliberately given back.
        val userId = createUser("alice@example.com")
        val alertId = storeAlert()

        assertFalse(deliveryRepository.confirmDelivery(alertId, userId, DeliveryChannel.PUSH))
        assertFalse(deliveryRepository.hasBeenDelivered(alertId, userId))
    }

    @Test
    fun `a delivery can be claimed exactly once`() {
        val userId = createUser("alice@example.com")
        val alertId = storeAlert()

        assertTrue(deliveryRepository.claimDelivery(alertId, userId))
        assertFalse(deliveryRepository.claimDelivery(alertId, userId))
        assertTrue(deliveryRepository.hasBeenDelivered(alertId, userId))
    }

    /**
     * One meteorological event is one arrival for a person: three locations
     * inside the same storm must not become three notifications.
     */
    @Test
    fun `several matched locations of one user still yield a single delivery`() {
        val userId = createUser("alice@example.com")
        createLocation(userId, "Dom", "1465")
        createLocation(userId, "Praca", "1261")
        createLocation(userId, "Działka", "3029")
        val alertId = storeAlert(teryt = listOf("1465", "1261", "3029"))
        matchRepository.recordMatches(alertId)

        assertEquals(listOf(userId), deliveryRepository.findUsersAwaitingDelivery(alertId))
        assertTrue(deliveryRepository.claimDelivery(alertId, userId))
        assertTrue(deliveryRepository.findUsersAwaitingDelivery(alertId).isEmpty())
    }

    @Test
    fun `each matched user is awaited independently`() {
        val alice = createUser("alice@example.com")
        val bob = createUser("bob@example.com")
        createLocation(alice, "Dom", "1465")
        createLocation(bob, "Dom", "1465")
        val alertId = storeAlert(teryt = listOf("1465"))
        matchRepository.recordMatches(alertId)

        deliveryRepository.claimDelivery(alertId, alice)

        assertEquals(listOf(bob), deliveryRepository.findUsersAwaitingDelivery(alertId))
    }

    /** A location saved mid-warning must not be missed as "already handled". */
    @Test
    fun `a user matched later still awaits delivery`() {
        val alice = createUser("alice@example.com")
        createLocation(alice, "Dom", "1465")
        val alertId = storeAlert(teryt = listOf("1465"))
        matchRepository.recordMatches(alertId)
        deliveryRepository.claimDelivery(alertId, alice)

        val bob = createUser("bob@example.com")
        createLocation(bob, "Dom", "1465")
        matchRepository.recordMatches(alertId)

        assertEquals(listOf(bob), deliveryRepository.findUsersAwaitingDelivery(alertId))
    }

    /**
     * Two channels racing (WebSocket fan-out and a push worker in Faza 5) must
     * not both win. The guarantee has to come from the unique constraint, not
     * from a read-then-write check that both would pass.
     */
    @Test
    fun `concurrent claims produce exactly one winner`() {
        val userId = createUser("alice@example.com")
        val alertId = storeAlert()
        val threads = 8

        val pool = Executors.newFixedThreadPool(threads)
        try {
            val tasks = List(threads) { Callable { deliveryRepository.claimDelivery(alertId, userId) } }
            val winners = pool.invokeAll(tasks).count { it.get() }
            assertEquals(1, winners)
        } finally {
            pool.shutdown()
        }
    }

    /** Read straight from the table: the repository exposes no getter for it. */
    private fun channelOf(alertId: Long, userId: Long): String? =
        jdbcTemplate.queryForObject(
            "SELECT channel FROM alert_delivery WHERE alert_id = ? AND user_id = ?",
            String::class.java,
            alertId,
            userId,
        )

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
            name.hashCode() % 90 / 1.0,
            name.hashCode() % 180 / 1.0,
            terytCode,
        )
    }

    private fun storeAlert(
        teryt: List<String> = listOf("1465"),
        imgwId: String = "Gd2026072600001",
    ): Long =
        alertRepository.upsert(
            AlertDraft(
                imgwId = imgwId,
                event = "Burze",
                severity = WarningSeverity.LEVEL_1,
                probabilityPercent = 80,
                validFrom = Instant.parse("2026-07-26T20:00:00Z"),
                validTo = Instant.parse("2026-07-27T08:00:00Z"),
                publishedAt = Instant.parse("2026-07-26T10:02:00Z"),
                content = "Prognozowane są burze.",
                comment = null,
                office = null,
                terytCodes = teryt,
            ),
        ).alert.id
}
