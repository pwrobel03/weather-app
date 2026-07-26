package com.weatherapp.backend.alert

import com.weatherapp.backend.imgw.ImgwClient
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service

data class AlertIngestResult(val fetched: Int, val mapped: Int, val rejected: Int)

@Service
class AlertIngestService(
    private val imgwClient: ImgwClient,
    private val alertMapper: AlertMapper,
) {

    private val log = LoggerFactory.getLogger(javaClass)

    /**
     * Fetches the current warning feed and maps it into the domain.
     *
     * One malformed warning must not cost us the rest of the batch: a storm
     * warning covering 50 powiats is not worth dropping because an unrelated
     * heat warning arrived with a field we cannot parse. Rejects are counted
     * and logged individually so a real upstream change is loud rather than
     * silently swallowed.
     */
    fun ingest(): List<AlertDraft> {
        val warnings = imgwClient.fetchMeteoWarnings()
        val drafts = mutableListOf<AlertDraft>()
        var rejected = 0

        for (warning in warnings) {
            try {
                drafts += alertMapper.toDraft(warning)
            } catch (ex: AlertMappingException) {
                rejected++
                log.warn("Skipping unmappable IMGW warning: {}", ex.message)
            }
        }

        val result = AlertIngestResult(fetched = warnings.size, mapped = drafts.size, rejected = rejected)
        if (result.rejected > 0) {
            log.warn("IMGW ingest: {} fetched, {} mapped, {} rejected", result.fetched, result.mapped, result.rejected)
        } else {
            log.info("IMGW ingest: {} warnings fetched and mapped", result.mapped)
        }
        return drafts
    }
}
