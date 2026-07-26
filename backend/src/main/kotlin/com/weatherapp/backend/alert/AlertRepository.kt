package com.weatherapp.backend.alert

import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Repository
import org.springframework.transaction.annotation.Transactional
import java.sql.ResultSet
import java.sql.Timestamp

/** Outcome of storing one warning, so callers can tell arrivals from re-publications. */
data class AlertUpsertResult(val alert: Alert, val isNew: Boolean)

@Repository
class AlertRepository(private val jdbcTemplate: JdbcTemplate) {

    /**
     * Stores a warning, keyed on IMGW's own id.
     *
     * The feed republishes every active warning on every poll, for the whole
     * validity window - nine hours or more is routine. `isNew` is what stops
     * that from becoming a notification storm: only a genuine first sighting
     * is an arrival.
     *
     * A re-publication still refreshes the mutable fields, because IMGW does
     * amend live warnings in place (extending validity, revising text) without
     * issuing a new id.
     */
    @Transactional
    fun upsert(draft: AlertDraft): AlertUpsertResult {
        val existingId = findIdByImgwId(draft.imgwId)

        val id = jdbcTemplate.queryForObject(
            """
            INSERT INTO alert (
                imgw_id, event, severity, probability_percent,
                valid_from, valid_to, published_at, content, imgw_comment, office
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (imgw_id) DO UPDATE SET
                event = EXCLUDED.event,
                severity = EXCLUDED.severity,
                probability_percent = EXCLUDED.probability_percent,
                valid_from = EXCLUDED.valid_from,
                valid_to = EXCLUDED.valid_to,
                published_at = EXCLUDED.published_at,
                content = EXCLUDED.content,
                imgw_comment = EXCLUDED.imgw_comment,
                office = EXCLUDED.office,
                last_seen_at = now()
            RETURNING id
            """.trimIndent(),
            Long::class.java,
            draft.imgwId,
            draft.event,
            draft.severity.level,
            draft.probabilityPercent,
            Timestamp.from(draft.validFrom),
            Timestamp.from(draft.validTo),
            draft.publishedAt?.let { Timestamp.from(it) },
            draft.content,
            draft.comment,
            draft.office,
        )!!

        replaceTerytCodes(id, draft.terytCodes)

        return AlertUpsertResult(alert = findById(id)!!, isNew = existingId == null)
    }

    fun findByImgwId(imgwId: String): Alert? = findIdByImgwId(imgwId)?.let { findById(it) }

    fun findById(id: Long): Alert? =
        jdbcTemplate.query(
            "SELECT $SELECT_COLUMNS FROM alert WHERE id = ?",
            { rs, _ -> rs.toAlert() },
            id,
        ).firstOrNull()
            ?.let { it.copy(terytCodes = findTerytCodes(it.id)) }

    private fun findIdByImgwId(imgwId: String): Long? =
        jdbcTemplate.query(
            "SELECT id FROM alert WHERE imgw_id = ?",
            { rs, _ -> rs.getLong("id") },
            imgwId,
        ).firstOrNull()

    private fun findTerytCodes(alertId: Long): List<String> =
        jdbcTemplate.query(
            "SELECT teryt_code FROM alert_teryt WHERE alert_id = ? ORDER BY teryt_code",
            { rs, _ -> rs.getString("teryt_code") },
            alertId,
        )

    /**
     * Replaced wholesale rather than merged: IMGW can shrink a warning's area
     * as a system moves through, and a merge would leave it covering powiats
     * the warning no longer applies to.
     */
    private fun replaceTerytCodes(alertId: Long, terytCodes: List<String>) {
        jdbcTemplate.update("DELETE FROM alert_teryt WHERE alert_id = ?", alertId)
        val distinct = terytCodes.distinct()
        if (distinct.isEmpty()) return
        jdbcTemplate.batchUpdate(
            "INSERT INTO alert_teryt (alert_id, teryt_code) VALUES (?, ?)",
            distinct.map { arrayOf<Any>(alertId, it) },
        )
    }

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
        const val SELECT_COLUMNS =
            "id, imgw_id, event, severity, probability_percent, valid_from, valid_to, " +
                "published_at, content, imgw_comment, office"
    }
}
