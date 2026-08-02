package com.weatherapp.backend.realtime

import kotlin.test.assertFalse
import org.junit.jupiter.api.Test
import org.springframework.web.client.RestClient

/**
 * What the client does when it has no key.
 *
 * A supported state rather than a misconfiguration: a developer running the
 * stack locally has none, and the socket still delivers warnings. A backend
 * that refused to start, or threw on every alert, would make push a
 * prerequisite for working on the forecast.
 */
class FcmPushClientTest {

    private fun client(properties: FcmProperties) =
        FcmPushClient(RestClient.builder(), properties)

    private val message = FcmMessage("token", "title", "body", emptyMap())

    @Test
    fun `sends nothing, and says so, when no key is configured`() {
        val sent = client(FcmProperties()).send(listOf(message))

        assertFalse(sent)
    }

    @Test
    fun `treats a project id without a key as unconfigured`() {
        // Half a configuration is the shape a broken deploy takes - one of the
        // two environment variables set. It has to behave like none at all
        // rather than like a credential failure at 3am.
        val sent = client(FcmProperties(projectId = "weather-app-4505f")).send(listOf(message))

        assertFalse(sent)
    }

    @Test
    fun `refuses an empty batch rather than reporting success`() {
        // The return value releases or keeps a delivery claim. Reporting true
        // for nothing sent would mark somebody as warned about a storm they
        // were never told about.
        val sent = client(FcmProperties()).send(emptyList())

        assertFalse(sent)
    }
}
