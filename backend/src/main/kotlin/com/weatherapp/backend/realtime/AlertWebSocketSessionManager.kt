package com.weatherapp.backend.realtime

import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component
import org.springframework.web.socket.WebSocketSession
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CopyOnWriteArraySet

/**
 * In-memory registry of connected WebSocket sessions grouped by authenticated
 * user ID.
 *
 * Designed for single-instance topology (see markdown/follow-up.md point 4).
 * A user might be connected simultaneously on multiple devices (e.g. tablet and
 * phone), so we maintain a concurrent set of sessions per user ID rather than a
 * 1:1 mapping.
 */
@Component
class AlertWebSocketSessionManager {

    private val log = LoggerFactory.getLogger(javaClass)
    private val sessionsByUserId = ConcurrentHashMap<Long, CopyOnWriteArraySet<WebSocketSession>>()

    fun register(userId: Long, session: WebSocketSession) {
        sessionsByUserId.computeIfAbsent(userId) { CopyOnWriteArraySet() }.add(session)
        log.debug("Registered WebSocket session {} for user {}", session.id, userId)
    }

    fun unregister(userId: Long, session: WebSocketSession) {
        sessionsByUserId[userId]?.let { sessions ->
            sessions.remove(session)
            if (sessions.isEmpty()) {
                sessionsByUserId.remove(userId, emptySet())
            }
        }
        log.debug("Unregistered WebSocket session {} for user {}", session.id, userId)
    }

    fun getSessions(userId: Long): Set<WebSocketSession> =
        sessionsByUserId[userId] ?: emptySet()

    fun getConnectedUserIds(): Set<Long> = sessionsByUserId.keys

    fun getTotalSessionsCount(): Int = sessionsByUserId.values.sumOf { it.size }
}
