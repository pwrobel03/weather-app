package com.weatherapp.backend.imgw

import org.slf4j.Logger
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component
import org.springframework.web.client.HttpClientErrorException
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
                .uri(WARNINGS_PATH)
                .retrieve()
                .body<List<ImgwWarningResponse>>()
                // A null body means the response was unusable, which is not the
                // same as "no warnings" and must not be mistaken for it.
                ?: throw ImgwClientException("IMGW returned an empty response body for meteo warnings")
        } catch (ex: HttpClientErrorException.NotFound) {
            // A calm day is a 404, not an empty array.
            //
            // Verified against the live endpoint on 2026-07-27, while nothing
            // was in force anywhere in Poland: the feed answers
            // 404 {"status":false,"message":"No products were found"}. The
            // hydrological feed answered 200 at the same moment, so this is
            // IMGW saying "nothing to report" rather than being down.
            //
            // Treating it as a failure - which is what this did - means the
            // ingest throws on every run of every calm day, so warnings that
            // have ended are never cleared and the app can never get back from
            // "warning in force" to "all quiet". That is the wrong way round
            // for a warning app: the calm case has to be the reliable one.
            //
            // The path is a compile-time constant, so a 404 here cannot be a
            // mistyped URL that only some requests hit.
            log.info("IMGW reports no meteorological warnings in force ({})", ex.statusCode)
            return emptyList()
        } catch (ex: RestClientException) {
            throw ImgwClientException("Failed to fetch meteorological warnings from IMGW", ex)
        }
    }

    private companion object {
        const val WARNINGS_PATH = "/api/data/warningsmeteo"
        val log: Logger = LoggerFactory.getLogger(ImgwClient::class.java)
    }
}
