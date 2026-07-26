package com.weatherapp.backend.meteoalarm

import org.springframework.stereotype.Component

/** CAP metadata for one IMGW warning, normalised out of the MeteoAlarm feed. */
data class CapEnrichment(
    val imgwId: String,
    val eventEn: String?,
    val severity: String?,
    val urgency: String?,
    val certainty: String?,
    val awarenessLevel: String?,
    val awarenessType: String?,
)

@Component
class CapEnrichmentMapper {

    /**
     * Collapses the feed into one enrichment per IMGW warning.
     *
     * MeteoAlarm splits a single IMGW warning into one CAP alert per powiat -
     * a storm over 50 powiats arrives as 50 entries carrying identical CAP
     * metadata and differing only in geocode. Area is already known from IMGW
     * itself, so the first entry per warning is enough and the rest are
     * redundant.
     */
    fun toEnrichments(warnings: List<MeteoAlarmWarning>): Map<String, CapEnrichment> {
        val result = LinkedHashMap<String, CapEnrichment>()
        for (warning in warnings) {
            val alert = warning.alert ?: continue
            val imgwId = extractImgwId(alert.identifier) ?: continue
            if (result.containsKey(imgwId)) continue

            // Prefer English: the Polish text duplicates what IMGW already
            // gave us, while the English name is the value MeteoAlarm adds.
            val info = alert.info.orEmpty()
            val chosen = info.firstOrNull { it.language?.startsWith("en") == true }
                ?: info.firstOrNull()
                ?: continue

            val parameters = chosen.parameter.orEmpty()
            result[imgwId] = CapEnrichment(
                imgwId = imgwId,
                eventEn = chosen.event,
                severity = chosen.severity,
                urgency = chosen.urgency,
                certainty = chosen.certainty,
                awarenessLevel = parameters.firstOrNull { it.valueName == AWARENESS_LEVEL }?.value,
                awarenessType = parameters.firstOrNull { it.valueName == AWARENESS_TYPE }?.value,
            )
        }
        return result
    }

    /**
     * Pulls IMGW's own warning id out of the CAP identifier.
     *
     * Shape: "2.49.0.0.616.0.PL.Sk20260722102818137.PL2208" - the second-to-last
     * dot-separated segment is IMGW's id, the last is the powiat geocode. This
     * is what makes the join exact rather than a fuzzy match on event name and
     * time, which would be hopeless when a dozen storm warnings share both.
     */
    private fun extractImgwId(identifier: String?): String? {
        val parts = identifier?.split('.') ?: return null
        if (parts.size < 2) return null
        val candidate = parts[parts.size - 2]
        return candidate.takeIf { IMGW_ID_PATTERN.matches(it) }
    }

    private companion object {
        const val AWARENESS_LEVEL = "awareness_level"
        const val AWARENESS_TYPE = "awareness_type"

        /** Two office letters followed by a timestamp, e.g. "Sk20260722102818137". */
        val IMGW_ID_PATTERN = Regex("^[A-Za-z]{2}\\d{8,}$")
    }
}
