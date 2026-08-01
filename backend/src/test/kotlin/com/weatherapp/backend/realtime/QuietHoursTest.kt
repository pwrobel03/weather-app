package com.weatherapp.backend.realtime

import com.weatherapp.backend.alert.WarningSeverity
import java.time.Instant
import kotlin.test.assertFalse
import kotlin.test.assertTrue
import org.junit.jupiter.api.Test

/**
 * Which warnings are allowed to wake somebody, and when.
 *
 * No container and no Spring context: this is arithmetic over a clock, and the
 * questions it answers are the ones somebody will be angry about either way -
 * woken at 3am for a gust of wind, or not woken for a storm.
 */
class QuietHoursTest {

    /** 01:00 in Warsaw on a winter night: UTC+1, so 00:00 UTC. */
    private val night = Instant.parse("2026-12-21T00:00:00Z")

    /** 13:00 in Warsaw on the same day. */
    private val afternoon = Instant.parse("2026-12-21T12:00:00Z")

    @Test
    fun `holds back a level 1 warning in the middle of the night`() {
        assertFalse(QuietHours.allows(WarningSeverity.LEVEL_1, night, "Europe/Warsaw"))
    }

    @Test
    fun `lets a level 1 warning through in the afternoon`() {
        assertTrue(QuietHours.allows(WarningSeverity.LEVEL_1, afternoon, "Europe/Warsaw"))
    }

    @Test
    fun `never holds back level 2 or 3, at any hour`() {
        // The assertion this whole object is subordinate to. Quiet hours are a
        // preference about noise; danger to life is not subject to preferences,
        // and there is deliberately no setting that changes this.
        assertTrue(QuietHours.allows(WarningSeverity.LEVEL_2, night, "Europe/Warsaw"))
        assertTrue(QuietHours.allows(WarningSeverity.LEVEL_3, night, "Europe/Warsaw"))
    }

    @Test
    fun `measures the hour where the device is, not where the server is`() {
        // The same instant is night in Warsaw and afternoon in Auckland. This
        // is the whole reason the zone rides on the token (decision 20), and it
        // is asserted as a disagreement between two devices about one moment.
        assertFalse(QuietHours.allows(WarningSeverity.LEVEL_1, night, "Europe/Warsaw"))
        assertTrue(QuietHours.allows(WarningSeverity.LEVEL_1, night, "Pacific/Auckland"))
    }

    @Test
    fun `follows the zone across a daylight saving change`() {
        // 21:30 UTC is 22:30 in Warsaw in winter and 23:30 in summer - both
        // inside the window. 20:30 UTC is 21:30 in winter (outside) and 22:30
        // in summer (inside), which is the case a fixed offset gets wrong.
        val winterEvening = Instant.parse("2026-12-21T20:30:00Z")
        val summerEvening = Instant.parse("2026-06-21T20:30:00Z")

        assertTrue(QuietHours.allows(WarningSeverity.LEVEL_1, winterEvening, "Europe/Warsaw"))
        assertFalse(QuietHours.allows(WarningSeverity.LEVEL_1, summerEvening, "Europe/Warsaw"))
    }

    @Test
    fun `opens exactly at seven and closes exactly at ten`() {
        // 06:00 UTC is 07:00 in Warsaw in winter: the first minute anybody may
        // be woken. 21:00 UTC is 22:00: the first minute they may not.
        assertTrue(QuietHours.allows(WarningSeverity.LEVEL_1, Instant.parse("2026-12-21T06:00:00Z"), "Europe/Warsaw"))
        assertFalse(QuietHours.allows(WarningSeverity.LEVEL_1, Instant.parse("2026-12-21T05:59:00Z"), "Europe/Warsaw"))
        assertFalse(QuietHours.allows(WarningSeverity.LEVEL_1, Instant.parse("2026-12-21T21:00:00Z"), "Europe/Warsaw"))
    }

    @Test
    fun `notifies rather than silences when the zone is unreadable`() {
        // A device that somehow stored a bad identifier gets woken as though it
        // had none. The failure direction costs somebody sleep instead of
        // costing them a warning, and only one of those is recoverable.
        assertTrue(QuietHours.allows(WarningSeverity.LEVEL_1, night, "Nowhere/Nothing"))
    }
}
