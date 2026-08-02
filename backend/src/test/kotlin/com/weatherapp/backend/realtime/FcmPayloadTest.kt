package com.weatherapp.backend.realtime

import kotlin.test.assertEquals
import kotlin.test.assertTrue
import org.junit.jupiter.api.Test

/**
 * The shape of what goes to Firebase.
 *
 * Every assertion here corresponds to something that was wrong on a real phone
 * before it was right. No container and no network: the payload is a map, and
 * the reason the first real push arrived silent was that nobody could look at
 * one without a device in hand.
 */
class FcmPayloadTest {

    private val message = FcmMessage(
        token = "fcm-device-token",
        title = "Ostrzeżenie 2. stopnia: Burze",
        body = "Dotyczy: Kraków. Prognozuje się burze.",
        data = mapOf(
            "alertId" to 928L,
            "severity" to "2",
            "matchedLocations" to "Kraków, Zgierz",
            "absent" to null,
        ),
    )

    @Suppress("UNCHECKED_CAST")
    private fun body(): Map<String, Any> = fcmPayload(message)["message"] as Map<String, Any>

    @Test
    fun `names the channel the app configured`() {
        // The one that cost an afternoon. Without this Firebase picks a channel
        // of its own and the notification lands at importance 3 - a quiet line
        // in the shade - instead of the importance 4 the app asked for, which
        // is the one that makes a sound. Delivered by every measure the server
        // can see, and silent on the phone.
        val android = body()["android"] as Map<*, *>
        val notification = android["notification"] as Map<*, *>

        assertEquals(ALERTS_CHANNEL_ID, notification["channel_id"])
    }

    @Test
    fun `matches the channel id the mobile client creates`() {
        // Two sides of one string with nothing checking they agree. This test
        // is the check; the literal is repeated on purpose so a rename on the
        // Kotlin side alone fails here rather than in production.
        assertEquals("alerts", ALERTS_CHANNEL_ID)
    }

    @Test
    fun `asks for high priority, so a warning survives Doze`() {
        val android = body()["android"] as Map<*, *>

        assertEquals("HIGH", android["priority"])
    }

    @Test
    fun `stringifies every data value`() {
        // FCM v1 rejects a data map containing anything but strings, and the
        // alert id arriving as a number is the obvious way to trip it - on the
        // one message that mattered, at 3am, with nothing to retry it.
        val data = body()["data"] as Map<*, *>

        assertEquals("928", data["alertId"])
        assertEquals("2", data["severity"])
        assertTrue(data.values.all { it is String })
    }

    @Test
    fun `turns a null into an empty string rather than dropping the key`() {
        // A missing key and a key with nothing in it read differently on the
        // client, and only one of them is what the server meant.
        val data = body()["data"] as Map<*, *>

        assertEquals("", data["absent"])
    }

    @Test
    fun `carries the title and body the dispatcher composed`() {
        val notification = body()["notification"] as Map<*, *>

        assertEquals("Ostrzeżenie 2. stopnia: Burze", notification["title"])
        assertEquals("Dotyczy: Kraków. Prognozuje się burze.", notification["body"])
    }

    @Test
    fun `addresses exactly one device`() {
        // FCM v1 has no batch endpoint. One message, one token - and the caller
        // loops, which is why a partial failure has to fail the whole batch.
        assertEquals("fcm-device-token", body()["token"])
    }
}
