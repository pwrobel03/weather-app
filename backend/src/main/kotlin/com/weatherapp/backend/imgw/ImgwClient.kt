package com.weatherapp.backend.imgw

import org.springframework.stereotype.Component
import org.springframework.web.client.RestClient
import org.springframework.web.client.RestClientException
import org.springframework.web.client.body

/**
 * Reads the public IMGW meteorological warnings feed. No API key, no quota.
 *
 * Deliberately uncached, unlike the Open-Meteo client: this is polled on a
 * schedule the app itself controls, and a cache in front of it would only make
 * warnings arrive later than they otherwise would - the opposite of the point.
 */
@Component
class ImgwClient(
    restClientBuilder: RestClient.Builder,
    properties: ImgwProperties,
) {

    private val restClient = restClientBuilder.clone().baseUrl(properties.baseUrl).build()

    fun fetchMeteoWarnings(): List<ImgwWarningResponse> {
        try {
            return restClient.get()
                .uri("/api/data/warningsmeteo")
                .retrieve()
                .body<List<ImgwWarningResponse>>()
                // An empty feed is the normal state on a calm day, and arrives
                // as `[]`. A null body is not that - it means the response was
                // unusable, so it must not be mistaken for "no warnings".
                ?: throw ImgwClientException("IMGW returned an empty response body for meteo warnings")
        } catch (ex: RestClientException) {
            throw ImgwClientException("Failed to fetch meteorological warnings from IMGW", ex)
        }
    }
}
