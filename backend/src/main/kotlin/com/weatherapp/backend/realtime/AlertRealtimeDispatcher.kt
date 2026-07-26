package com.weatherapp.backend.realtime

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.SerializationFeature
import com.weatherapp.backend.alert.Alert
import com.weatherapp.backend.alert.AlertDeliveryRepository
import com.weatherapp.backend.alert.AlertMatchRepository
import com.weatherapp.backend.alert.WarningSeverity
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service
import org.springframework.web.socket.TextMessage
import java.io.IOException
import java.time.Instant

/**
 * Payload sent over real-time delivery channels (WebSocket and Expo Push).
 *
 * Includes the specific saved location names of the target user that fall inside
 * the warning's area, giving the user immediate geographical context.
 */
data class AlertRealtimeNotification(
    val id: Long,
    val event: String,
    val severity: WarningSeverity,
    val probabilityPercent: Int?,
    val validFrom: Instant,
    val validTo: Instant,
    val content: String?,
    val matchedLocations: List<String>,
)

@Service
class AlertRealtimeDispatcher(
    private val alertDeliveryRepository: AlertDeliveryRepository,
    private val alertMatchRepository: AlertMatchRepository,
    private val sessionManager: AlertWebSocketSessionManager,
) {

    private val log = LoggerFactory.getLogger(javaClass)
    private val mapper = ObjectMapper()
        .findAndRegisterModules()
        .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)

    /**
     * Fans out warnings to currently connected WebSocket clients using coroutines.
     *
     * Uses the pre-calculated matches from [AlertDeliveryRepository.findUsersAwaitingDelivery],
     * which runs an indexed TERYT lookup in PostgreSQL.
     */
    fun dispatch(alerts: List<Alert>) = runBlocking {
        for (alert in alerts) {
            launch(Dispatchers.Default) {
                dispatchAlert(alert)
            }
        }
    }

    private suspend fun dispatchAlert(alert: Alert) {
        val awaitingUsers = alertDeliveryRepository.findUsersAwaitingDelivery(alert.id)
        if (awaitingUsers.isEmpty()) return

        // Fan out only to users who have an active WebSocket session
        val connectedUsers = awaitingUsers.filter { sessionManager.getSessions(it).isNotEmpty() }
        if (connectedUsers.isEmpty()) return

        coroutineScope {
            for (userId in connectedUsers) {
                launch(Dispatchers.IO) {
                    deliverToUser(alert, userId)
                }
            }
        }
    }

    private fun deliverToUser(alert: Alert, userId: Long) {
        val sessions = sessionManager.getSessions(userId)
        if (sessions.isEmpty()) return

        // Claim delivery right in the database to prevent duplicate notifications
        // across racing channels (e.g. WebSocket and Push).
        if (!alertDeliveryRepository.claimDelivery(alert.id, userId)) {
            return
        }

        val locationNames = alertMatchRepository.findMatchedLocationNames(alert.id, userId)
        val notification = AlertRealtimeNotification(
            id = alert.id,
            event = alert.event,
            severity = alert.severity,
            probabilityPercent = alert.probabilityPercent,
            validFrom = alert.validFrom,
            validTo = alert.validTo,
            content = alert.content,
            matchedLocations = locationNames,
        )

        val textMessage = TextMessage(mapper.writeValueAsString(notification))
        for (session in sessions) {
            if (session.isOpen) {
                try {
                    session.sendMessage(textMessage)
                    log.debug("Delivered alert {} over WebSocket session {} to user {}", alert.id, session.id, userId)
                } catch (ex: IOException) {
                    log.warn("Failed sending alert {} over WebSocket session {} to user {}", alert.id, session.id, userId, ex)
                }
            }
        }
    }
}
