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
     */
    fun sendPushNotifications(messages: List<ExpoPushMessage>) {
        if (messages.isEmpty()) return
        try {
            restClient.post()
                .uri("/--/api/v2/push/send")
                .contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.APPLICATION_JSON)
                .body(messages)
                .retrieve()
                .toBodilessEntity()
        } catch (ex: RestClientException) {
            log.warn("Failed sending push notifications to Expo relay: {}", ex.message, ex)
        }
    }
}
