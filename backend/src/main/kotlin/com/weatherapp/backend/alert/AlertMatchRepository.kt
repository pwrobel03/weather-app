package com.weatherapp.backend.alert

import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Repository
import java.sql.Timestamp
import java.time.Instant

@Repository
class AlertMatchRepository(private val jdbcTemplate: JdbcTemplate) {

    /**
     * Records every saved location covered by this alert, and returns how many
     * matches were newly recorded.
     *
     * This is the hot path of the whole alert core, and it is deliberately a
     * plain equality join: IMGW publishes areas as powiat codes rather than
     * geometry, so `saved_location.teryt_code = alert_teryt.teryt_code` gives
     * exactly the same answer a PostGIS query would, using the B-tree index
     * from V6 instead of GiST (follow-up.md point 2).
     *
     * ON CONFLICT DO NOTHING makes re-ingest harmless: the feed republishes
     * every active warning on every poll, and a match already recorded must
     * not count as a fresh one.
     *
     * Locations with a NULL teryt_code - abroad, or outside every known
     * boundary - never match, which is intended, not an oversight.
     */
    fun recordMatches(alertId: Long): Int =
        jdbcTemplate.update(
            """
            INSERT INTO alert_location_match (alert_id, saved_location_id)
            SELECT at.alert_id, sl.id
            FROM alert_teryt at
            JOIN saved_location sl ON sl.teryt_code = at.teryt_code
            WHERE at.alert_id = ?
            ON CONFLICT DO NOTHING
            """.trimIndent(),
            alertId,
        )

    /**
     * Matches one freshly-saved location against the warnings already in force.
     *
     * Without this, matching only ever happens during ingest, so someone who
     * saves a location while a warning is already running sees nothing until
     * the next poll - up to the full ingest interval. For a person who just
     * added their home town during a storm, that wait is the whole product
     * failing quietly.
     *
     * Restricted to warnings still valid: an expired one is history, and
     * recording a match for it now would put it on the location's timeline as
     * though it had been relevant to that place all along.
     */
    fun recordMatchesForLocation(savedLocationId: Long, now: Instant = Instant.now()): Int =
        jdbcTemplate.update(
            """
            INSERT INTO alert_location_match (alert_id, saved_location_id)
            SELECT at.alert_id, sl.id
            FROM saved_location sl
            JOIN alert_teryt at ON at.teryt_code = sl.teryt_code
            JOIN alert a ON a.id = at.alert_id
            WHERE sl.id = ? AND a.valid_to > ?
            ON CONFLICT DO NOTHING
            """.trimIndent(),
            savedLocationId,
            Timestamp.from(now),
        )

    /** Distinct users with at least one location covered by this alert. */
    fun findMatchedUserIds(alertId: Long): List<Long> =
        jdbcTemplate.query(
            """
            SELECT DISTINCT sl.user_id
            FROM alert_location_match alm
            JOIN saved_location sl ON sl.id = alm.saved_location_id
            WHERE alm.alert_id = ?
            ORDER BY sl.user_id
            """.trimIndent(),
            { rs, _ -> rs.getLong("user_id") },
            alertId,
        )

    /**
     * Saved locations of one user that this alert is worth notifying about.
     *
     * The threshold is per place, so the comparison happens per row: a warning
     * matching the house at level 1 and the allotment at level 3 notifies about
     * the house alone, and the notification names only what it woke you for.
     *
     * Compared as text on purpose. `min_severity` and the alert's severity are
     * both the IMGW level, '1' to '3', and single characters order the same
     * lexically as numerically - so this needs no cast, no lookup table, and no
     * agreement about which direction "higher severity" counts in.
     */
    fun findNotifiableLocationNames(alertId: Long, userId: Long, severity: WarningSeverity): List<String> =
        jdbcTemplate.query(
            """
            SELECT sl.name
            FROM alert_location_match alm
            JOIN saved_location sl ON sl.id = alm.saved_location_id
            WHERE alm.alert_id = ? AND sl.user_id = ? AND sl.min_severity <= ?
            ORDER BY sl.name
            """.trimIndent(),
            { rs, _ -> rs.getString("name") },
            alertId,
            userId,
            severity.level,
        )

    /** Saved locations of one user covered by this alert, whatever their threshold. */
    fun findMatchedLocationNames(alertId: Long, userId: Long): List<String> =
        jdbcTemplate.query(
            """
            SELECT sl.name
            FROM alert_location_match alm
            JOIN saved_location sl ON sl.id = alm.saved_location_id
            WHERE alm.alert_id = ? AND sl.user_id = ?
            ORDER BY sl.name
            """.trimIndent(),
            { rs, _ -> rs.getString("name") },
            alertId,
            userId,
        )
}
