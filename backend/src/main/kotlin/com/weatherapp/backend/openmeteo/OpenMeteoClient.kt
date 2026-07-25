package com.weatherapp.backend.openmeteo

import org.springframework.cache.annotation.Cacheable
import org.springframework.stereotype.Component
import org.springframework.web.client.RestClient
import org.springframework.web.client.RestClientException
import org.springframework.web.client.body

@Component
class OpenMeteoClient(
    restClientBuilder: RestClient.Builder,
    properties: OpenMeteoProperties,
) {

    private val restClient = restClientBuilder.clone().baseUrl(properties.baseUrl).build()
    private val geocodingClient = restClientBuilder.clone().baseUrl(properties.geocodingBaseUrl).build()

    @Cacheable(OpenMeteoCachingConfig.CACHE_NAME)
    fun fetchForecast(latitude: Double, longitude: Double): OpenMeteoForecastResponse {
        try {
            return restClient.get()
                .uri { builder ->
                    builder.path("/v1/forecast")
                        .queryParam("latitude", latitude)
                        .queryParam("longitude", longitude)
                        .queryParam("current", CURRENT_FIELDS)
                        .queryParam("hourly", HOURLY_FIELDS)
                        .queryParam("daily", DAILY_FIELDS)
                        .queryParam("timezone", "auto")
                        .build()
                }
                .retrieve()
                .body<OpenMeteoForecastResponse>()
                ?: throw OpenMeteoClientException("Open-Meteo returned an empty response body")
        } catch (ex: RestClientException) {
            throw OpenMeteoClientException(
                "Failed to fetch forecast from Open-Meteo for ($latitude, $longitude)",
                ex,
            )
        }
    }

    @Cacheable(OpenMeteoCachingConfig.GEOCODING_CACHE_NAME)
    fun searchLocations(name: String, count: Int = 10, language: String = "pl"): OpenMeteoGeocodingResponse {
        try {
            return geocodingClient.get()
                .uri { builder ->
                    builder.path("/v1/search")
                        .queryParam("name", name)
                        .queryParam("count", count)
                        .queryParam("language", language)
                        .build()
                }
                .retrieve()
                .body<OpenMeteoGeocodingResponse>()
                ?: OpenMeteoGeocodingResponse(emptyList())
        } catch (ex: RestClientException) {
            throw OpenMeteoClientException(
                "Failed to search locations from Open-Meteo for query '$name'",
                ex,
            )
        }
    }

    private companion object {
        const val CURRENT_FIELDS =
            "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m"
        const val HOURLY_FIELDS = "temperature_2m,precipitation_probability,weather_code"
        const val DAILY_FIELDS = "temperature_2m_max,temperature_2m_min,weather_code,precipitation_sum"
    }
}
