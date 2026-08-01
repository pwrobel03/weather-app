package com.weatherapp.backend.alert

import com.weatherapp.backend.meteoalarm.CapEnrichment
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Repository
import org.springframework.transaction.annotation.Transactional
import java.sql.ResultSet
import java.sql.Timestamp

/** Outcome of storing one warning, so callers can tell arrivals from re-publications. */
data class AlertUpsertResult(
    val alert: Alert,
    val isNew: Boolean,
    /**
     * What the warning said before this poll, when this poll changed it.
     *
     * Null both for a warning seen for the first time and - far more often -
     * for one that came back identical. The feed republishes every active
     * warning on every poll for its whole life, so "unchanged" is the normal
     * case by a wide margin and must not look like an amendment.
     */
    val previous: Alert? = null,
)

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
        val existing = findByImgwId(draft.imgwId)

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

        return AlertUpsertResult(
            alert = findById(id)!!,
            isNew = existing == null,
            previous = existing?.takeIf { it.differsFrom(draft) },
        )
    }

    fun findByImgwId(imgwId: String): Alert? = findIdByImgwId(imgwId)?.let { findById(it) }

    /**
     * Applies MeteoAlarm's CAP metadata to a stored warning.
     *
     * Returns false when the warning is unknown here, which is normal: the
     * MeteoAlarm feed covers warnings we may not have ingested yet, and it is
     * not this method's job to invent them.
     */
    fun applyCapEnrichment(enrichment: CapEnrichment): Boolean =
        jdbcTemplate.update(
            """
            UPDATE alert SET
                event_en = ?,
                cap_severity = ?,
                cap_urgency = ?,
                cap_certainty = ?,
                awareness_level = ?,
                awareness_type = ?,
                enriched_at = now()
            WHERE imgw_id = ?
            """.trimIndent(),
            enrichment.eventEn,
            enrichment.severity,
            enrichment.urgency,
            enrichment.certainty,
            enrichment.awarenessLevel,
            enrichment.awarenessType,
            enrichment.imgwId,
        ) > 0

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

/**
 * Whether IMGW actually changed anything, or merely republished.
 *
 * Compares only what IMGW authors. `lastSeenAt` moves on every poll by design,
 * and treating it as content would make every warning look amended every few
 * minutes for its entire nine-hour life - which is the single failure this
 * comparison exists to prevent.
 *
 * Teryt codes are deliberately out of scope: a change of area arrives as a
 * different warning with its own id, so comparing them would only add a field
 * that never differs.
 */
private fun Alert.differsFrom(draft: AlertDraft): Boolean =
    event != draft.event ||
        severity != draft.severity ||
        probabilityPercent != draft.probabilityPercent ||
        validFrom != draft.validFrom ||
        validTo != draft.validTo ||
        publishedAt != draft.publishedAt ||
        content != draft.content ||
        comment != draft.comment ||
        office != draft.office
