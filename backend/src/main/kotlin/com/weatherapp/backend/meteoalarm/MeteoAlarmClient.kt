package com.weatherapp.backend.meteoalarm

import org.springframework.boot.context.properties.ConfigurationProperties
import org.springframework.stereotype.Component
import org.springframework.web.client.RestClient
import org.springframework.web.client.RestClientException
import org.springframework.web.client.body

@ConfigurationProperties(prefix = "meteoalarm")
data class MeteoAlarmProperties(
    val baseUrl: String = "https://feeds.meteoalarm.org",
    val feedPath: String = "/api/v1/warnings/feeds-poland",
)

class MeteoAlarmClientException(message: String, cause: Throwable? = null) : RuntimeException(message, cause)

/**
 * Reads MeteoAlarm's CAP relay of the Polish warnings.
 *
 * The JSON API is used rather than the legacy Atom feed: both carry the same
 * CAP payload, and this one does not require XML namespace handling for data
 * that is ultimately consumed as plain fields.
 */
@Component
class MeteoAlarmClient(
    restClientBuilder: RestClient.Builder,
    private val properties: MeteoAlarmProperties,
) {

    private val restClient = restClientBuilder.clone().baseUrl(properties.baseUrl).build()

    fun fetchPolishWarnings(): List<MeteoAlarmWarning> {
        try {
            val feed = restClient.get()
                .uri(properties.feedPath)
                .retrieve()
                .body<MeteoAlarmFeed>()
                ?: throw MeteoAlarmClientException("MeteoAlarm returned an empty response body")
            return feed.warnings.orEmpty()
        } catch (ex: RestClientException) {
            throw MeteoAlarmClientException("Failed to fetch Polish warnings from MeteoAlarm", ex)
        }
    }
}
