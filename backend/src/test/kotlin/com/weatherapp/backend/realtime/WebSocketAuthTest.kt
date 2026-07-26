package com.weatherapp.backend.realtime

import com.weatherapp.backend.auth.JwtService
import com.weatherapp.backend.user.UserRole
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.web.server.LocalServerPort
import org.springframework.web.socket.CloseStatus
import org.springframework.web.socket.client.standard.StandardWebSocketClient
import org.springframework.web.socket.handler.TextWebSocketHandler
import java.util.concurrent.TimeUnit
import kotlin.test.assertEquals
import kotlin.test.assertTrue

@SpringBootTest(
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = [
        "spring.autoconfigure.exclude=" +
            "org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration," +
            "org.springframework.boot.flyway.autoconfigure.FlywayAutoConfiguration",
    ],
)
class WebSocketAuthTest {

    @LocalServerPort
    var port: Int = 0

    @Autowired
    lateinit var jwtService: JwtService

    @Autowired
    lateinit var sessionManager: AlertWebSocketSessionManager

    @Test
    fun `connects successfully with valid access token and registers user session`() {
        val token = jwtService.generateAccessToken(42L, UserRole.USER)
        val client = StandardWebSocketClient()
        val session = client.execute(object : TextWebSocketHandler() {}, "ws://localhost:$port/api/ws/alerts?token=$token")
            .get(5, TimeUnit.SECONDS)

        assertTrue(session.isOpen)
        assertEquals(1, sessionManager.getSessions(42L).size)

        session.close(CloseStatus.NORMAL)
        var attempts = 0
        while (sessionManager.getSessions(42L).isNotEmpty() && attempts < 20) {
            Thread.sleep(50)
            attempts++
        }
        assertEquals(0, sessionManager.getSessions(42L).size)
    }

    @Test
    fun `rejects connection with invalid token`() {
        val client = StandardWebSocketClient()
        assertThrows<Exception> {
            client.execute(object : TextWebSocketHandler() {}, "ws://localhost:$port/api/ws/alerts?token=invalid")
                .get(3, TimeUnit.SECONDS)
        }
        assertEquals(0, sessionManager.getSessions(999L).size)
    }

    @Test
    fun `rejects connection with missing token`() {
        val client = StandardWebSocketClient()
        assertThrows<Exception> {
            client.execute(object : TextWebSocketHandler() {}, "ws://localhost:$port/api/ws/alerts")
                .get(3, TimeUnit.SECONDS)
        }
        assertEquals(0, sessionManager.getSessions(999L).size)
    }
}
