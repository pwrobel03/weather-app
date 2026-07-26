package com.weatherapp.backend.alert

import com.weatherapp.backend.imgw.ImgwWarningResponse
import org.springframework.stereotype.Component
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.DateTimeParseException

class AlertMappingException(message: String, cause: Throwable? = null) : RuntimeException(message, cause)

@Component
class AlertMapper {

    fun toDraft(warning: ImgwWarningResponse): AlertDraft {
        val severity = try {
            WarningSeverity.fromLevel(warning.stopien)
        } catch (ex: IllegalArgumentException) {
            throw AlertMappingException("Warning ${warning.id} has an unmappable severity '${warning.stopien}'", ex)
        }

        return AlertDraft(
            imgwId = warning.id,
            event = warning.nazwaZdarzenia,
            severity = severity,
            // Absent upstream on some warnings, and a non-numeric value is a
            // shape change rather than a reason to drop an actual warning -
            // so it degrades to unknown instead of failing the mapping.
            probabilityPercent = warning.prawdopodobienstwo?.trim()?.toIntOrNull(),
            validFrom = parseTimestamp(warning.obowiazujeOd, warning.id, "obowiazuje_od"),
            validTo = parseTimestamp(warning.obowiazujeDo, warning.id, "obowiazuje_do"),
            publishedAt = warning.opublikowano?.let { parseTimestamp(it, warning.id, "opublikowano") },
            content = warning.tresc,
            comment = warning.komentarz,
            office = warning.biuro,
            terytCodes = warning.terytCodes,
        )
    }

    /**
     * IMGW timestamps carry no timezone ("2026-07-26 22:00:00"), so one has to
     * be assumed - and assuming wrong shifts every warning's validity window
     * by two hours in summer.
     *
     * Established from the feed itself rather than guessed: each warning id
     * embeds a UTC timestamp (e.g. "Gd20260726100250935" -> 10:02:50) while the
     * same warning's `opublikowano` reads 12:02:00. That +2h delta is exactly
     * the CEST offset, confirmed across multiple warnings on 2026-07-26. The
     * human-readable fields are therefore Polish local time.
     *
     * Using the zone (not a fixed offset) also keeps DST transitions correct.
     */
    private fun parseTimestamp(value: String, warningId: String, field: String): java.time.Instant =
        try {
            LocalDateTime.parse(value.trim(), TIMESTAMP_FORMAT).atZone(POLAND).toInstant()
        } catch (ex: DateTimeParseException) {
            throw AlertMappingException("Warning $warningId has an unparseable $field: '$value'", ex)
        }

    private companion object {
        val POLAND: ZoneId = ZoneId.of("Europe/Warsaw")
        val TIMESTAMP_FORMAT: DateTimeFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")
    }
}
