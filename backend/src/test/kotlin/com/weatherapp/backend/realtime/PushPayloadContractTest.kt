package com.weatherapp.backend.realtime

import com.fasterxml.jackson.databind.ObjectMapper
import com.weatherapp.backend.alert.WarningSeverity
import org.junit.jupiter.api.Test
import kotlin.test.assertEquals

/**
 * The push payload and the WebSocket payload describe the same warning, so a
 * client must be able to read `severity` the same way on both. They are built
 * by different code paths, which is exactly how they drifted apart.
 */
class PushPayloadContractTest {

    private val mapper = ObjectMapper().findAndRegisterModules()

    @Test
    fun `severity is the imgw level on both channels`() {
        val severity = WarningSeverity.LEVEL_2

        // What the WebSocket sends, via @JsonValue on the enum.
        val overSocket = mapper.writeValueAsString(severity).trim('"')
        // What the push data map carries.
        val overPush = severity.level

        assertEquals("2", overSocket)
        assertEquals(overSocket, overPush)
    }

    @Test
    fun `all three levels agree across channels`() {
        for (severity in WarningSeverity.entries) {
            assertEquals(
                mapper.writeValueAsString(severity).trim('"'),
                severity.level,
                "severity ${severity.name} differs between WebSocket and push",
            )
        }
    }

    /** Guards the specific regression: the enum constant name must never be the wire value. */
    @Test
    fun `the wire value is never the enum constant name`() {
        for (severity in WarningSeverity.entries) {
            assert(severity.level != severity.name)
        }
    }
}
