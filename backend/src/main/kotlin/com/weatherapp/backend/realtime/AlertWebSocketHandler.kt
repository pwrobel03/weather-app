package com.weatherapp.backend.realtime

import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component
import org.springframework.web.socket.CloseStatus
import org.springframework.web.socket.WebSocketSession
import org.springframework.web.socket.handler.TextWebSocketHandler

/**
 * WebSocket handler managing alert stream connections for authenticated users.
 *
 * Sessions are authenticated during the handshake via [JwtWebSocketHandshakeInterceptor],
 * which stores the validated user ID in session attributes.
 */
@Component
class AlertWebSocketHandler(
    private val sessionManager: AlertWebSocketSessionManager,
) : TextWebSocketHandler() {

    private val log = LoggerFactory.getLogger(javaClass)

    override fun afterConnectionEstablished(session: WebSocketSession) {
        val userId = session.attributes[JwtWebSocketHandshakeInterceptor.ATTR_USER_ID] as? Long
        if (userId == null) {
            log.warn("Closing unauthenticated WebSocket session {}", session.id)
            session.close(CloseStatus.POLICY_VIOLATION)
            return
        }
        sessionManager.register(userId, session)
        log.info("User {} connected to alert WebSocket (session {})", userId, session.id)
    }

    override fun afterConnectionClosed(session: WebSocketSession, status: CloseStatus) {
        val userId = session.attributes[JwtWebSocketHandshakeInterceptor.ATTR_USER_ID] as? Long
        if (userId != null) {
            sessionManager.unregister(userId, session)
            log.info("User {} disconnected from alert WebSocket (session {}, status {})", userId, session.id, status)
        }
    }

    override fun handleTransportError(session: WebSocketSession, exception: Throwable) {
        val userId = session.attributes[JwtWebSocketHandshakeInterceptor.ATTR_USER_ID] as? Long
        log.warn("Transport error on alert WebSocket session {} (user {}): {}", session.id, userId, exception.message)
        if (userId != null) {
            sessionManager.unregister(userId, session)
        }
        if (session.isOpen) {
            session.close(CloseStatus.SERVER_ERROR)
        }
    }
}
