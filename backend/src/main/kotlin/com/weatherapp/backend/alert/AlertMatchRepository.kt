package com.weatherapp.backend.alert

import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Repository

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

    /** Saved locations of one user covered by this alert, for naming them in a notification. */
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
