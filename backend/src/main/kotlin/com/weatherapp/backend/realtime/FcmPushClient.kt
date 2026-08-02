package com.weatherapp.backend.realtime

import com.google.auth.oauth2.GoogleCredentials
import java.io.ByteArrayInputStream
import org.slf4j.LoggerFactory
import org.springframework.http.MediaType
import org.springframework.stereotype.Component
import org.springframework.web.client.RestClient
import org.springframework.web.client.RestClientException

/**
 * One notification, in the shape FCM HTTP v1 expects.
 *
 * `data` values are all strings because FCM says so - the v1 API rejects a
 * payload whose data map contains a number, which is the kind of thing that
 * fails at 3am on the one message that mattered. Callers hand over whatever
 * they have and the conversion happens here, once.
 */
data class FcmMessage(
    val token: String,
    val title: String,
    val body: String,
    val data: Map<String, Any?>,
)

/**
 * Sends warnings straight to Firebase Cloud Messaging.
 *
 * Replaces the Expo relay (decision 27). The relay worked and was tested, but
 * it put a third party in the middle of the one channel whose entire purpose is
 * to wake somebody at 3am - and this project has no Expo account to lose.
 *
 * Android only, by construction. iOS delivery would go through APNs and needs a
 * paid Apple Developer account, which decision 26 put out of scope.
 */
@Component
class FcmPushClient(
    restClientBuilder: RestClient.Builder,
    private val properties: FcmProperties,
) {
    private val log = LoggerFactory.getLogger(javaClass)
    private val restClient = restClientBuilder.clone().baseUrl(properties.baseUrl).build()

    /**
     * Built once and refreshed by the library, not per request.
     *
     * The access token FCM wants lasts an hour. Minting a fresh one per
     * notification would add a round trip to Google in front of every warning;
     * caching one by hand would work until the day it expired mid-storm.
     */
    private val credentials: GoogleCredentials? by lazy {
        if (!properties.isConfigured) return@lazy null

        try {
            GoogleCredentials
                .fromStream(ByteArrayInputStream(properties.serviceAccountJson.toByteArray()))
                .createScoped("https://www.googleapis.com/auth/firebase.messaging")
        } catch (ex: Exception) {
            // A malformed key is a deployment mistake, and it must be loud in
            // the log - but it must not take the application down, or a typo in
            // one secret costs the forecast as well as the warnings.
            log.error("FCM service account key could not be read; push is disabled", ex)
            null
        }
    }

    /**
     * Sends one batch, reporting whether every message was accepted.
     *
     * FCM v1 has no batch endpoint - each message is its own request - so this
     * loops. The return value is deliberately all-or-nothing because of what the
     * caller does with it: a false releases the delivery claim so the warning can
     * be retried, and a partial success reported as success would mark somebody
     * as warned about a storm they were never told about.
     */
    fun send(messages: List<FcmMessage>): Boolean {
        if (messages.isEmpty()) return false

        val token = accessToken() ?: return false

        return messages.all { message -> send(message, token) }
    }

    private fun send(message: FcmMessage, accessToken: String): Boolean =
        try {
            restClient.post()
                .uri("/v1/projects/{projectId}/messages:send", properties.projectId)
                .header("Authorization", "Bearer $accessToken")
                .contentType(MediaType.APPLICATION_JSON)
                .body(
                    mapOf(
                        "message" to mapOf(
                            "token" to message.token,
                            "notification" to mapOf(
                                "title" to message.title,
                                "body" to message.body,
                            ),
                            // Every value stringified: FCM v1 rejects a data map
                            // containing anything else, and the alert id going in
                            // as a number is the obvious way to trip that.
                            "data" to message.data.mapValues { (_, value) -> value?.toString() ?: "" },
                            "android" to mapOf(
                                // A weather warning is the textbook case for
                                // this: it is time-critical and it is allowed to
                                // break through Doze.
                                "priority" to "HIGH",
                            ),
                        ),
                    ),
                )
                .retrieve()
                .toBodilessEntity()
            true
        } catch (ex: RestClientException) {
            log.warn("Failed sending push notification via FCM: {}", ex.message, ex)
            false
        }

    private fun accessToken(): String? {
        val credentials = credentials
        if (credentials == null) {
            // Not an error: a developer running the stack locally has no key,
            // and the socket still delivers. Logged at debug so it does not
            // shout on every warning in a development log.
            log.debug("FCM is not configured; no push sent")
            return null
        }

        return try {
            credentials.refreshIfExpired()
            credentials.accessToken?.tokenValue
        } catch (ex: Exception) {
            log.warn("Could not obtain an FCM access token: {}", ex.message, ex)
            null
        }
    }
}
