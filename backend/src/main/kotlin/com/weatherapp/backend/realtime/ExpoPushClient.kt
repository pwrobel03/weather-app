package com.weatherapp.backend.realtime

import org.slf4j.LoggerFactory
import org.springframework.http.MediaType
import org.springframework.stereotype.Component
import org.springframework.web.client.RestClient
import org.springframework.web.client.RestClientException

/**
 * Payload formatted for Expo's HTTP push API.
 *
 * Automatically relayed by Expo to Apple Push Notification service (APNs) for iOS
 * and Firebase Cloud Messaging (FCM) for Android without requiring direct Apple/Google credentials.
 */
data class ExpoPushMessage(
    val to: String,
    val title: String,
    val body: String,
    val data: Map<String, Any?>,
    val sound: String = "default",
    val priority: String = "high",
)

@Component
class ExpoPushClient(
    restClientBuilder: RestClient.Builder,
    properties: ExpoPushProperties,
) {
    private val log = LoggerFactory.getLogger(javaClass)
    private val restClient = restClientBuilder.clone().baseUrl(properties.baseUrl).build()

    /**
     * Sends a batch of push notifications to Expo's push servers.
     *
     * Returns whether the batch was accepted. The caller uses this to decide
     * if the delivery claim can stand: reporting success on a failed relay
     * would mark the user as warned about a storm they were never told about.
     */
    fun sendPushNotifications(messages: List<ExpoPushMessage>): Boolean {
        if (messages.isEmpty()) return false
        return try {
            restClient.post()
                .uri("/--/api/v2/push/send")
                .contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.APPLICATION_JSON)
                .body(messages)
                .retrieve()
                .toBodilessEntity()
            true
        } catch (ex: RestClientException) {
            log.warn("Failed sending push notifications to Expo relay: {}", ex.message, ex)
            false
        }
    }
}
