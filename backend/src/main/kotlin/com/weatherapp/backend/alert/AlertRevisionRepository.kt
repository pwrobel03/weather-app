package com.weatherapp.backend.alert

import java.sql.ResultSet
import java.sql.Timestamp
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Repository

@Repository
class AlertRevisionRepository(private val jdbcTemplate: JdbcTemplate) {

    /**
     * Stores the state a warning is being replaced *from*.
     *
     * Called with the row as it stood before an amendment was applied, so the
     * table reads as a history of what was true rather than of what arrived.
     * The current state is never duplicated here - it is in `alert`, and
     * writing it twice would make "how many times has this changed" a question
     * about an off-by-one.
     */
    fun record(alertId: Long, previous: Alert) {
        jdbcTemplate.update(
            """
            INSERT INTO alert_revision (
                alert_id, event, severity, probability_percent,
                valid_from, valid_to, published_at, content, imgw_comment, office
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """.trimIndent(),
            alertId,
            previous.event,
            previous.severity.level,
            previous.probabilityPercent,
            Timestamp.from(previous.validFrom),
            Timestamp.from(previous.validTo),
            previous.publishedAt?.let { Timestamp.from(it) },
            previous.content,
            previous.comment,
            previous.office,
        )
    }

    /** Oldest first, so a client reads the warning's life in the order it happened. */
    fun findByAlertId(alertId: Long): List<AlertRevision> =
        jdbcTemplate.query(
            """
            SELECT event, severity, probability_percent, valid_from, valid_to,
                   published_at, content, imgw_comment, office, recorded_at
            FROM alert_revision
            WHERE alert_id = ?
            ORDER BY recorded_at, id
            """.trimIndent(),
            { rs, _ -> rs.toRevision() },
            alertId,
        )

    private fun ResultSet.toRevision() = AlertRevision(
        event = getString("event"),
        severity = WarningSeverity.fromLevel(getString("severity")),
        probabilityPercent = getObject("probability_percent")?.let { getInt("probability_percent") },
        validFrom = getTimestamp("valid_from").toInstant(),
        validTo = getTimestamp("valid_to").toInstant(),
        publishedAt = getTimestamp("published_at")?.toInstant(),
        content = getString("content"),
        comment = getString("imgw_comment"),
        office = getString("office"),
        recordedAt = getTimestamp("recorded_at").toInstant(),
    )
}
