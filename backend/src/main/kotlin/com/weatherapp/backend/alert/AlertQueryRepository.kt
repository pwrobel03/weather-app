package com.weatherapp.backend.alert

import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Repository
import java.sql.ResultSet
import java.time.Instant

/** An alert together with the user's own locations it covers. */
data class AlertForUser(
    val alert: Alert,
    val affectedLocations: List<AffectedLocation>,
)

data class AffectedLocation(val id: Long, val name: String)

@Repository
class AlertQueryRepository(private val jdbcTemplate: JdbcTemplate) {

    /**
     * Alerts currently in force covering any of the user's saved locations.
     *
     * "In force" is `valid_to > now()`, evaluated in the database so it cannot
     * drift from the row's own timestamps. `valid_from` is deliberately not
     * filtered: IMGW routinely publishes warnings hours ahead, and a storm
     * starting at 22:00 is exactly what a user opening the app at 18:00 needs
     * to see.
     *
     * Ordered by severity first so the most dangerous warning leads, which is
     * also the order the UI needs.
     */
    fun findActiveForUser(userId: Long, now: Instant = Instant.now()): List<AlertForUser> =
        findForUser(
            userId = userId,
            extraCondition = "AND a.valid_to > ?",
            extraArgs = arrayOf(java.sql.Timestamp.from(now)),
            order = "ORDER BY a.severity DESC, a.valid_from",
        )

    /**
     * Every alert ever recorded for one of the user's locations, newest first.
     *
     * Scoped by user id as well as location id so a caller cannot read another
     * account's timeline by guessing a location id.
     */
    fun findHistoryForLocation(userId: Long, locationId: Long, limit: Int): List<AlertForUser> =
        findForUser(
            userId = userId,
            extraCondition = "AND sl.id = ?",
            extraArgs = arrayOf(locationId),
            order = "ORDER BY a.valid_from DESC",
            limit = limit,
        )

    /**
     * Warnings in force over one powiat, for a position nobody saved.
     *
     * Deliberately not routed through `alert_location_match`: that table
     * records which *saved* location a warning covers, and the point here is a
     * place the user is standing in rather than one they keep. Joining
     * `alert_teryt` directly answers the question without writing anything
     * down, which is what keeps a position out of the database.
     *
     * `affectedLocations` comes back empty for the same reason - there is no
     * saved location to name. The response shape is shared with the per-user
     * queries, and an empty list renders as nothing rather than as a stray
     * separator.
     */
    fun findActiveAtTeryt(terytCode: String, now: Instant = Instant.now()): List<AlertForUser> =
        jdbcTemplate.query(
            """
            SELECT $ALERT_COLUMNS
            FROM alert a
            JOIN alert_teryt at ON at.alert_id = a.id
            WHERE at.teryt_code = ? AND a.valid_to > ?
            ORDER BY a.severity DESC, a.valid_from
            """.trimIndent(),
            { rs, _ -> rs.toAlert() },
            terytCode,
            java.sql.Timestamp.from(now),
        ).map { AlertForUser(it, emptyList()) }

    private fun findForUser(
        userId: Long,
        extraCondition: String,
        extraArgs: Array<Any>,
        order: String,
        limit: Int? = null,
    ): List<AlertForUser> {
        val rows = jdbcTemplate.query(
            """
            SELECT $ALERT_COLUMNS, sl.id AS location_id, sl.name AS location_name
            FROM alert a
            JOIN alert_location_match alm ON alm.alert_id = a.id
            JOIN saved_location sl ON sl.id = alm.saved_location_id
            WHERE sl.user_id = ?
            $extraCondition
            $order
            """.trimIndent(),
            { rs, _ -> rs.toAlert() to AffectedLocation(rs.getLong("location_id"), rs.getString("location_name")) },
            userId,
            *extraArgs,
        )

        // Grouped in memory rather than with a lateral join: one alert covers
        // at most a handful of a single user's locations, so this stays tiny
        // and keeps the ordering above authoritative.
        val grouped = rows.groupBy({ it.first.id }, { it })
        val ordered = rows.map { it.first.id }.distinct()
        val result = ordered.map { alertId ->
            val entries = grouped.getValue(alertId)
            val alert = entries.first().first
            AlertForUser(
                alert = alert.copy(terytCodes = findTerytCodes(alertId)),
                affectedLocations = entries.map { it.second }.distinctBy { it.id }.sortedBy { it.name },
            )
        }
        return if (limit != null) result.take(limit) else result
    }

    private fun findTerytCodes(alertId: Long): List<String> =
        jdbcTemplate.query(
            "SELECT teryt_code FROM alert_teryt WHERE alert_id = ? ORDER BY teryt_code",
            { rs, _ -> rs.getString("teryt_code") },
            alertId,
        )

    private fun ResultSet.toAlert() = Alert(
        id = getLong("id"),
        imgwId = getString("imgw_id"),
        event = getString("event"),
        severity = WarningSeverity.fromLevel(getString("severity")),
        probabilityPercent = getObject("probability_percent")?.let { getInt("probability_percent") },
        validFrom = getTimestamp("valid_from").toInstant(),
        validTo = getTimestamp("valid_to").toInstant(),
        publishedAt = getTimestamp("published_at")?.toInstant(),
        content = getString("content"),
        comment = getString("imgw_comment"),
        office = getString("office"),
        terytCodes = emptyList(),
    )

    private companion object {
        const val ALERT_COLUMNS =
            "a.id, a.imgw_id, a.event, a.severity, a.probability_percent, a.valid_from, " +
                "a.valid_to, a.published_at, a.content, a.imgw_comment, a.office"
    }
}
