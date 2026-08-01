package com.weatherapp.backend.alert

import com.fasterxml.jackson.annotation.JsonCreator
import com.fasterxml.jackson.annotation.JsonValue
import java.time.Instant

/**
 * IMGW's official three-level warning scale.
 *
 * Serialises as "1"/"2"/"3" to match `WarningSeveritySchema` in
 * packages/contract - the shared contract deliberately keeps the raw source
 * values so a mismatch against the live API shows up immediately. Labels and
 * colours are a client-side i18n concern and live nowhere near this enum.
 */
enum class WarningSeverity(@get:JsonValue val level: String) {
    LEVEL_1("1"),
    LEVEL_2("2"),
    LEVEL_3("3"),
    ;

    companion object {
        @JvmStatic
        @JsonCreator
        fun fromLevel(level: String): WarningSeverity =
            entries.firstOrNull { it.level == level.trim() }
                ?: throw IllegalArgumentException("Unknown IMGW warning level '$level'")
    }
}

/**
 * A warning as received from IMGW, before it has been stored.
 *
 * Kept separate from [Alert] so the absence of a database identity is a fact
 * of the type rather than a nullable field everything downstream has to
 * re-check.
 */
data class AlertDraft(
    val imgwId: String,
    val event: String,
    val severity: WarningSeverity,
    val probabilityPercent: Int?,
    val validFrom: Instant,
    val validTo: Instant,
    val publishedAt: Instant?,
    val content: String?,
    val comment: String?,
    val office: String?,
    /**
     * The powiat codes this warning covers - the only notion of area IMGW
     * publishes. Matching is a literal lookup against these, which is why
     * saved_location.teryt_code is indexed (see V6).
     */
    val terytCodes: List<String>,
)

/** A stored warning. */
data class Alert(
    val id: Long,
    val imgwId: String,
    val event: String,
    val severity: WarningSeverity,
    val probabilityPercent: Int?,
    val validFrom: Instant,
    val validTo: Instant,
    val publishedAt: Instant?,
    val content: String?,
    val comment: String?,
    val office: String?,
    val terytCodes: List<String>,
)

/**
 * What a warning said before IMGW changed it.
 *
 * A full snapshot rather than a set of differences (decision 21): it answers
 * "what did this say at 14:00" without replaying a chain, and a field added to
 * [Alert] later needs no migration of the history behind it.
 *
 * Deliberately without `terytCodes`. IMGW amends a warning's severity and its
 * hours; a change of area arrives as a different warning with its own id, so
 * carrying the codes here would store a value that never varies.
 */
data class AlertRevision(
    val event: String,
    val severity: WarningSeverity,
    val probabilityPercent: Int?,
    val validFrom: Instant,
    val validTo: Instant,
    val publishedAt: Instant?,
    val content: String?,
    val comment: String?,
    val office: String?,
    /** When we noticed, not when IMGW published - those differ by up to one poll. */
    val recordedAt: Instant,
)
