package com.weatherapp.backend.realtime

import com.weatherapp.backend.alert.WarningSeverity
import java.time.Instant
import java.time.LocalTime
import java.time.ZoneId

/**
 * When a level 1 warning is allowed to wake somebody.
 *
 * The threshold from commit 130 answers "is this worth telling me about at
 * all". This answers a narrower question: something worth telling me about in
 * the morning is not necessarily worth telling me about now.
 *
 * Only the lowest level is ever held back. Level 2 and 3 wake the phone at any
 * hour, without an opt-out, and that is deliberate - a warning of danger to
 * life that arrives silently because of a preference is the one failure this
 * application cannot survive. Somebody who does not want those has the
 * threshold instead, which is an explicit choice per place rather than a rule
 * that quietly applies at night.
 *
 * Not configurable, at least not yet. A fixed window is a claim the app can
 * defend - "we do not wake you before seven for the mildest warnings" - where
 * a per-user window is a setting somebody sets once, forgets, and is then
 * surprised by. If that turns out to be wrong, the window moves here and
 * nothing else changes.
 */
object QuietHours {

    /** 22:00 to 07:00 local. Deliberately wider than the night, on the quiet side. */
    private val FROM: LocalTime = LocalTime.of(22, 0)
    private val UNTIL: LocalTime = LocalTime.of(7, 0)

    fun allows(severity: WarningSeverity, at: Instant, timeZone: String): Boolean {
        if (severity != WarningSeverity.LEVEL_1) return true

        val local = try {
            LocalTime.ofInstant(at, ZoneId.of(timeZone))
        } catch (_: Exception) {
            // An unknown zone must not silence a warning. A device that somehow
            // registered a bad identifier gets notified as if it had none,
            // which is the failure direction that costs somebody sleep rather
            // than costing them a warning.
            return true
        }

        // The window wraps midnight, so "inside" is two ranges rather than one.
        return local < FROM && local >= UNTIL
    }
}
