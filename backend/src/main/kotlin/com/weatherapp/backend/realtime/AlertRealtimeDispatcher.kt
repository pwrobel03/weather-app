package com.weatherapp.backend.realtime

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.SerializationFeature
import com.weatherapp.backend.alert.Alert
import com.weatherapp.backend.alert.AlertDeliveryRepository
import com.weatherapp.backend.alert.AlertMatchRepository
import com.weatherapp.backend.alert.AlertQueryRepository
import com.weatherapp.backend.alert.WarningSeverity
import com.weatherapp.backend.user.UserPushTokenRepository
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
    private val alertQueryRepository: AlertQueryRepository,
    private val userPushTokenRepository: UserPushTokenRepository,
    private val expoPushClient: ExpoPushClient,
    private val sessionManager: AlertWebSocketSessionManager,
) {

    private val log = LoggerFactory.getLogger(javaClass)
    private val mapper = ObjectMapper()
        .findAndRegisterModules()
        .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)

    /**
     * Fans out warnings to currently connected WebSocket clients using coroutines,
     * or delivers via Expo APNs/FCM push notifications if the client is in the background.
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

    /**
     * Delivers any active, undelivered warnings to a freshly connected user.
     *
     * Called when a WebSocket session opens so a client returning from network loss
     * (or after a server restart) immediately catches up on anything published while offline.
     */
    fun deliverMissedAlerts(userId: Long) {
        val activeAlerts = alertQueryRepository.findActiveForUser(userId)
        if (activeAlerts.isEmpty()) return

        for (alertForUser in activeAlerts) {
            val alertId = alertForUser.alert.id
            if (alertDeliveryRepository.claimDelivery(alertId, userId)) {
                val notification = AlertRealtimeNotification(
                    id = alertId,
                    event = alertForUser.alert.event,
                    severity = alertForUser.alert.severity,
                    probabilityPercent = alertForUser.alert.probabilityPercent,
                    validFrom = alertForUser.alert.validFrom,
                    validTo = alertForUser.alert.validTo,
                    content = alertForUser.alert.content,
                    matchedLocations = alertForUser.affectedLocations.map { it.name },
                )
                if (!sendNotification(notification, userId)) {
                    releaseUndelivered(alertId, userId)
                }
            }
        }
    }

    private suspend fun dispatchAlert(alert: Alert) {
        val awaitingUsers = alertDeliveryRepository.findUsersAwaitingDelivery(alert.id)
        if (awaitingUsers.isEmpty()) return

        coroutineScope {
            for (userId in awaitingUsers) {
                launch(Dispatchers.IO) {
                    deliverToUser(alert, userId)
                }
            }
        }
    }

    private fun deliverToUser(alert: Alert, userId: Long) {
        val sessions = sessionManager.getSessions(userId)
        // Grouped by language: one user can hold devices set to different
        // languages, which is exactly why the locale rides on the token rather
        // than on the account (follow-up.md point 12).
        val pushTokens = if (sessions.isEmpty()) {
            userPushTokenRepository.findTokensByUserIdGroupedByLocale(userId)
        } else {
            emptyMap()
        }

        if (sessions.isEmpty() && pushTokens.isEmpty()) return

        // Which of this user's matched places are worth a notification at this
        // level. Read before the delivery claim, deliberately: claiming and
        // then finding nothing to say would burn the once-only guarantee on a
        // notification that never went out, and the next warning for the same
        // place would look like a duplicate and be dropped.
        val locationNames = alertMatchRepository.findNotifiableLocationNames(alert.id, userId, alert.severity)
        if (locationNames.isEmpty()) {
            log.debug(
                "Alert {} matched user {} but is below the threshold at every matched place",
                alert.id,
                userId,
            )
            return
        }

        // Claim delivery right in the database to prevent duplicate notifications
        // across racing channels (e.g. WebSocket and Push).
        if (!alertDeliveryRepository.claimDelivery(alert.id, userId)) {
            return
        }

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

        val delivered = if (sessions.isNotEmpty()) {
            sendNotification(notification, userId)
        } else {
            sendPushNotification(notification, pushTokens)
        }

        if (!delivered) {
            releaseUndelivered(alert.id, userId)
        }
    }

    /**
     * Hands the claim back so the user is offered this alert again - on the
     * next poll, or on their next reconnect via [deliverMissedAlerts].
     */
    private fun releaseUndelivered(alertId: Long, userId: Long) {
        alertDeliveryRepository.releaseDelivery(alertId, userId)
        log.warn("Released undelivered alert {} for user {}; will be retried", alertId, userId)
    }

    /** Returns true once the payload has actually gone out over at least one open session. */
    private fun sendNotification(notification: AlertRealtimeNotification, userId: Long): Boolean {
        val sessions = sessionManager.getSessions(userId)
        if (sessions.isEmpty()) return false

        val textMessage = TextMessage(mapper.writeValueAsString(notification))
        var delivered = false
        for (session in sessions) {
            if (!session.isOpen) continue
            try {
                // Synchronized because a WebSocketSession is not safe for
                // concurrent writes, and one user can be targeted by the
                // fan-out and by a reconnect catch-up at the same time.
                synchronized(session) { session.sendMessage(textMessage) }
                delivered = true
                log.debug("Delivered alert {} over WebSocket session {} to user {}", notification.id, session.id, userId)
            } catch (ex: IOException) {
                log.warn("Failed sending alert {} over WebSocket session {} to user {}", notification.id, session.id, userId, ex)
            }
        }
        return delivered
    }

    private fun sendPushNotification(
        notification: AlertRealtimeNotification,
        tokensByLocale: Map<String, List<String>>,
    ): Boolean {
        // One message per language, not per device: three phones set to the
        // same language cost one composed string.
        val messages = tokensByLocale.flatMap { (locale, tokens) ->
            val title = PushMessages.title(locale, notification.event, notification.severity.level)
            // IMGW's own text, in Polish whatever the device asked for. It is a
            // safety instruction, and a machine translation of one is a
            // liability rather than a feature.
            val body = "${PushMessages.affects(locale, notification.matchedLocations)}${notification.content ?: ""}".trim()

            tokens.map { token ->
            ExpoPushMessage(
                to = token,
                title = title,
                body = body,
                data = mapOf(
                    "alertId" to notification.id,
                    "event" to notification.event,
                    // The IMGW level ("1"/"2"/"3"), matching both the WebSocket
                    // payload and WarningSeveritySchema in packages/contract.
                    // Using .name here handed the mobile client "LEVEL_1" over
                    // push and "1" over the socket for the same field.
                    "severity" to notification.severity.level,
                    "matchedLocations" to notification.matchedLocations,
                ),
            )
            }
        }
        val delivered = expoPushClient.sendPushNotifications(messages)
        if (delivered) {
            log.debug("Dispatched {} push notification(s) for alert {} via Expo", messages.size, notification.id)
        }
        return delivered
    }
}
