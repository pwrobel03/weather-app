package com.weatherapp.backend.alert

import com.weatherapp.backend.imgw.ImgwClient
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service

data class AlertIngestResult(
    val fetched: Int,
    val rejected: Int,
    /** Warnings seen for the first time - the only ones worth notifying about. */
    val newAlerts: List<Alert>,
    /** Warnings already known, refreshed in place. */
    val updatedAlerts: List<Alert>,
    /** Saved locations newly matched across the whole batch. */
    val matchesRecorded: Int,
)

@Service
class AlertIngestService(
    private val imgwClient: ImgwClient,
    private val alertMapper: AlertMapper,
    private val alertRepository: AlertRepository,
    private val alertMatchRepository: AlertMatchRepository,
) {

    private val log = LoggerFactory.getLogger(javaClass)

    /**
     * Fetches the current warning feed, maps it, and stores it.
     *
     * The feed is a snapshot of everything currently in force, not a stream of
     * new events - the same warning comes back on every poll for its entire
     * validity window. Separating new from updated is what keeps a nine-hour
     * storm warning from producing a notification every ten minutes.
     *
     * One malformed warning must not cost the rest of the batch: a storm
     * warning covering 50 powiats is not worth dropping because an unrelated
     * heat warning arrived with a field we cannot parse. Rejects are counted
     * and logged individually so a real upstream change is loud.
     */
    fun ingest(): AlertIngestResult {
        val warnings = imgwClient.fetchMeteoWarnings()
        val newAlerts = mutableListOf<Alert>()
        val updatedAlerts = mutableListOf<Alert>()
        var rejected = 0
        var matchesRecorded = 0

        for (warning in warnings) {
            try {
                val result = alertRepository.upsert(alertMapper.toDraft(warning))
                if (result.isNew) newAlerts += result.alert else updatedAlerts += result.alert
                // Also re-run for known warnings: an amended area can newly
                // cover a location, and users save new locations while a
                // warning is still in force.
                matchesRecorded += alertMatchRepository.recordMatches(result.alert.id)
            } catch (ex: AlertMappingException) {
                rejected++
                log.warn("Skipping unmappable IMGW warning: {}", ex.message)
            }
        }

        if (rejected > 0) {
            log.warn(
                "IMGW ingest: {} fetched, {} new, {} updated, {} matches, {} rejected",
                warnings.size, newAlerts.size, updatedAlerts.size, matchesRecorded, rejected,
            )
        } else {
            log.info(
                "IMGW ingest: {} fetched, {} new, {} updated, {} matches",
                warnings.size, newAlerts.size, updatedAlerts.size, matchesRecorded,
            )
        }

        return AlertIngestResult(
            fetched = warnings.size,
            rejected = rejected,
            newAlerts = newAlerts,
            updatedAlerts = updatedAlerts,
            matchesRecorded = matchesRecorded,
        )
    }
}
