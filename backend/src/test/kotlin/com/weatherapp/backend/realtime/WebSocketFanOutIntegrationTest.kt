package com.weatherapp.backend.realtime

import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import com.weatherapp.backend.KartozaPostgisContainer
import com.weatherapp.backend.alert.AlertDeliveryRepository
import com.weatherapp.backend.alert.AlertIngestService
import com.weatherapp.backend.alert.WarningSeverity
import com.weatherapp.backend.auth.JwtService
import com.weatherapp.backend.imgw.ImgwClient
import com.weatherapp.backend.imgw.ImgwWarningResponse
import com.weatherapp.backend.meteoalarm.MeteoAlarmClient
import com.weatherapp.backend.user.UserPushTokenRepository
import com.weatherapp.backend.user.UserRole
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.check
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.web.server.LocalServerPort
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.web.socket.CloseStatus
import org.springframework.web.socket.TextMessage
import org.springframework.web.socket.WebSocketSession
import org.springframework.web.socket.client.standard.StandardWebSocketClient
import org.springframework.web.socket.handler.TextWebSocketHandler
import org.testcontainers.containers.wait.strategy.Wait
import org.testcontainers.junit.jupiter.Container
import org.testcontainers.junit.jupiter.Testcontainers
import java.time.Duration
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.TimeUnit
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * Fan-out end to end over a real WebSocket against a real database: a warning
 * ingested on the server reaches the right connected client and nobody else,
 * a client returning from network loss catches up, and a backgrounded client
 * falls back to push.
 *
 * Only the three upstream HTTP clients are stubbed.
 */
@Testcontainers
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class WebSocketFanOutIntegrationTest {

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

        /**
         * IMGW timestamps are naive Polish local time (see AlertMapper), so
         * fixtures have to be written in that zone. Formatting `Instant.now()`
         * directly would silently shift every window by the CEST offset.
         */
        private val POLAND: ZoneId = ZoneId.of("Europe/Warsaw")
        private val IMGW_FORMAT: DateTimeFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")

        fun imgwTimestamp(instant: Instant): String =
            IMGW_FORMAT.format(instant.atZone(POLAND))
    }

    @LocalServerPort
    var port: Int = 0

    @MockitoBean
    lateinit var imgwClient: ImgwClient

    @MockitoBean
    lateinit var meteoAlarmClient: MeteoAlarmClient

    @MockitoBean
    lateinit var fcmPushClient: FcmPushClient

    @Autowired
    lateinit var ingestService: AlertIngestService

    @Autowired
    lateinit var deliveryRepository: AlertDeliveryRepository

    @Autowired
    lateinit var userPushTokenRepository: UserPushTokenRepository

    @Autowired
    lateinit var jwtService: JwtService

    @Autowired
    lateinit var sessionManager: AlertWebSocketSessionManager

    @Autowired
    lateinit var jdbcTemplate: JdbcTemplate

    private val objectMapper = jacksonObjectMapper().apply { registerModule(JavaTimeModule()) }

    private val openSessions = CopyOnWriteArrayList<WebSocketSession>()

    @BeforeEach
    fun setUp() {
        jdbcTemplate.update("TRUNCATE alert CASCADE")
        jdbcTemplate.update("TRUNCATE users CASCADE")
        whenever(meteoAlarmClient.fetchPolishWarnings()) doReturn emptyList()
        // The relay reports success by default. Without this the mock returns
        // false, the dispatcher correctly treats that as "not delivered" and
        // releases the claim - which is a different scenario, covered in
        // AlertDeliveryReleaseTest.
        whenever(fcmPushClient.send(any())) doReturn true
    }

    @AfterEach
    fun tearDown() {
        for (session in openSessions) {
            if (session.isOpen) {
                session.close(CloseStatus.NORMAL)
            }
        }
        openSessions.clear()
        // Let server-side close handlers finish unregistering before the next test.
        Thread.sleep(100)
    }

    @Test
    fun `warning arrives and reaches connected client instantly without page refresh`() {
        val insideId = createUserWithLocation("inside@example.com", "Dom", "3029")
        val outsideId = createUserWithLocation("outside@example.com", "Dom", "1465")

        val insideHandler = connectWebSocket(insideId)
        val outsideHandler = connectWebSocket(outsideId)
        assertEquals(1, sessionManager.getSessions(insideId).size)
        assertEquals(1, sessionManager.getSessions(outsideId).size)

        whenever(imgwClient.fetchMeteoWarnings()) doReturn listOf(warning(teryt = listOf("3029")))
        val result = ingestService.ingest()
        assertEquals(1, result.newAlerts.size)

        val receivedJson = insideHandler.messages.poll(3, TimeUnit.SECONDS)
        assertNotNull(receivedJson, "User inside storm area must immediately receive WebSocket warning")
        val notification = objectMapper.readValue<AlertRealtimeNotification>(receivedJson)
        assertEquals(result.newAlerts.single().id, notification.id)
        assertEquals("Burze", notification.event)
        assertEquals(WarningSeverity.LEVEL_2, notification.severity)
        assertEquals(listOf("Dom"), notification.matchedLocations)

        val outsideMsg = outsideHandler.messages.poll(500, TimeUnit.MILLISECONDS)
        assertNull(outsideMsg, "User outside storm area must not receive notifications")

        assertTrue(deliveryRepository.findUsersAwaitingDelivery(result.newAlerts.single().id).isEmpty())
        verify(fcmPushClient, never()).send(any())
    }

    /** Severity must arrive as IMGW's own level, matching packages/contract. */
    @Test
    fun `severity crosses the wire as the imgw level`() {
        val userId = createUserWithLocation("inside@example.com", "Dom", "3029")
        val handler = connectWebSocket(userId)

        whenever(imgwClient.fetchMeteoWarnings()) doReturn listOf(warning(stopien = "3", teryt = listOf("3029")))
        ingestService.ingest()

        val receivedJson = handler.messages.poll(3, TimeUnit.SECONDS)
        assertNotNull(receivedJson)
        assertTrue(
            receivedJson.contains("\"severity\":\"3\""),
            "severity must serialise as \"3\", got: $receivedJson",
        )
    }

    @Test
    fun `client returning after network loss catches up on missed alerts immediately upon connection`() {
        val offlineUserId = createUserWithLocation("reconnect@example.com", "Działka", "3029")

        whenever(imgwClient.fetchMeteoWarnings()) doReturn listOf(warning(teryt = listOf("3029")))
        val result = ingestService.ingest()
        val alertId = result.newAlerts.single().id
        assertEquals(listOf(offlineUserId), deliveryRepository.findUsersAwaitingDelivery(alertId))

        val reconnectHandler = connectWebSocket(offlineUserId)

        val receivedJson = reconnectHandler.messages.poll(3, TimeUnit.SECONDS)
        assertNotNull(receivedJson, "Reconnecting user must immediately receive undelivered active alert")
        val notification = objectMapper.readValue<AlertRealtimeNotification>(receivedJson)
        assertEquals(alertId, notification.id)
        assertEquals(listOf("Działka"), notification.matchedLocations)
        assertTrue(deliveryRepository.findUsersAwaitingDelivery(alertId).isEmpty())
    }

    /** Reconnecting again must not replay a warning the user has already seen. */
    @Test
    fun `a second reconnect does not replay an already delivered alert`() {
        val userId = createUserWithLocation("reconnect@example.com", "Działka", "3029")
        whenever(imgwClient.fetchMeteoWarnings()) doReturn listOf(warning(teryt = listOf("3029")))
        ingestService.ingest()

        val first = connectWebSocket(userId)
        assertNotNull(first.messages.poll(3, TimeUnit.SECONDS))

        val second = connectWebSocket(userId)
        assertNull(second.messages.poll(500, TimeUnit.MILLISECONDS))
    }

    @Test
    fun `offline user in background receives push notification via Expo relay`() {
        val backgroundUserId = createUserWithLocation("background@example.com", "Praca", "3029")
        userPushTokenRepository.upsert(backgroundUserId, "fcm-device-token-test12345", "pl", "Europe/Warsaw")

        whenever(imgwClient.fetchMeteoWarnings()) doReturn listOf(warning(teryt = listOf("3029")))
        val result = ingestService.ingest()
        val alertId = result.newAlerts.single().id

        verify(fcmPushClient).send(
            check { messages ->
                assertEquals(1, messages.size)
                assertEquals("fcm-device-token-test12345", messages[0].token)
                assertTrue(messages[0].title.contains("Burze"))
                assertTrue(messages[0].body.contains("Praca"))
                assertEquals(alertId, messages[0].data["alertId"])
                // Same representation the WebSocket sends - a client must not
                // need two parsers for one field.
                assertEquals("2", messages[0].data["severity"])
            },
        )
        assertTrue(deliveryRepository.findUsersAwaitingDelivery(alertId).isEmpty())
    }

    /** A connected socket wins; push is the fallback, not a second copy. */
    @Test
    fun `a connected user is not also pushed`() {
        val userId = createUserWithLocation("both@example.com", "Dom", "3029")
        userPushTokenRepository.upsert(userId, "fcm-device-token-test12345", "pl", "Europe/Warsaw")
        val handler = connectWebSocket(userId)

        whenever(imgwClient.fetchMeteoWarnings()) doReturn listOf(warning(teryt = listOf("3029")))
        ingestService.ingest()

        assertNotNull(handler.messages.poll(3, TimeUnit.SECONDS))
        verify(fcmPushClient, never()).send(any())
    }

    private fun connectWebSocket(userId: Long): RecordingWebSocketHandler {
        val token = jwtService.generateAccessToken(userId, UserRole.USER)
        val handler = RecordingWebSocketHandler()
        val client = StandardWebSocketClient()
        val session = client.execute(handler, "ws://localhost:$port/api/ws/alerts?token=$token")
            .get(5, TimeUnit.SECONDS)
        openSessions.add(session)
        var attempts = 0
        while (sessionManager.getSessions(userId).isEmpty() && attempts < 20) {
            Thread.sleep(50)
            attempts++
        }
        return handler
    }

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
            52.2297,
            21.0122,
            terytCode,
        )
        return userId
    }

    private fun warning(
        imgwId: String = "Gd20260726100250935",
        stopien: String = "2",
        teryt: List<String>,
    ) = ImgwWarningResponse(
        id = imgwId,
        nazwaZdarzenia = "Burze",
        stopien = stopien,
        prawdopodobienstwo = "80",
        obowiazujeOd = imgwTimestamp(Instant.now().minus(Duration.ofHours(1))),
        obowiazujeDo = imgwTimestamp(Instant.now().plus(Duration.ofHours(6))),
        opublikowano = imgwTimestamp(Instant.now().minus(Duration.ofHours(1))),
        tresc = "Prognozowane są burze, którym miejscami będą towarzyszyć silne opady deszczu.",
        komentarz = "Brak.",
        biuro = "Centralne Biuro Prognoz Meteorologicznych w Warszawie",
        teryt = teryt,
    )

    class RecordingWebSocketHandler : TextWebSocketHandler() {
        val messages = LinkedBlockingQueue<String>()

        override fun handleTextMessage(session: WebSocketSession, message: TextMessage) {
            messages.offer(message.payload)
        }
    }
}
