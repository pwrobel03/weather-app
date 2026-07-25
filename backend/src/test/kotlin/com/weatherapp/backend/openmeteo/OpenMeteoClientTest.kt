package com.weatherapp.backend.openmeteo

import org.hamcrest.CoreMatchers.startsWith
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.springframework.http.MediaType
import org.springframework.test.web.client.MockRestServiceServer
import org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo
import org.springframework.test.web.client.response.MockRestResponseCreators.withServerError
import org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess
import org.springframework.web.client.RestClient
import kotlin.test.assertEquals

class OpenMeteoClientTest {

    private lateinit var mockServer: MockRestServiceServer
    private lateinit var client: OpenMeteoClient

    @BeforeEach
    fun setUp() {
        val builder = RestClient.builder()
        mockServer = MockRestServiceServer.bindTo(builder).build()
        client = OpenMeteoClient(
            builder,
            OpenMeteoProperties(baseUrl = BASE_URL, geocodingBaseUrl = GEOCODING_BASE_URL),
        )
    }

    @Test
    fun `maps a successful forecast response`() {
        mockServer.expect(requestTo(startsWith("$BASE_URL/v1/forecast")))
            .andRespond(withSuccess(FORECAST_JSON, MediaType.APPLICATION_JSON))

        val response = client.fetchForecast(52.23, 21.01)

        assertEquals(52.23, response.latitude)
        assertEquals(21.01, response.longitude)
        assertEquals(5.3, response.current?.temperature2m)
        assertEquals(3, response.current?.weatherCode)
        assertEquals(listOf(5.3, 4.8), response.hourly?.temperature2m)
        assertEquals(listOf(7.2), response.daily?.temperature2mMax)
    }

    @Test
    fun `wraps upstream errors in a client exception`() {
        mockServer.expect(requestTo(startsWith("$BASE_URL/v1/forecast")))
            .andRespond(withServerError())

        assertThrows<OpenMeteoClientException> { client.fetchForecast(52.23, 21.01) }
    }

    @Test
    fun `maps a successful geocoding response`() {
        mockServer.expect(requestTo(startsWith("$GEOCODING_BASE_URL/v1/search")))
            .andRespond(withSuccess(GEOCODING_JSON, MediaType.APPLICATION_JSON))

        val response = client.searchLocations("Warszawa", 10, "pl")

        assertEquals(1, response.results?.size)
        val result = response.results?.first()!!
        assertEquals(756135L, result.id)
        assertEquals("Warszawa", result.name)
        assertEquals("PL", result.countryCode)
        assertEquals("Województwo Mazowieckie", result.admin1)
    }

    @Test
    fun `wraps geocoding errors in a client exception`() {
        mockServer.expect(requestTo(startsWith("$GEOCODING_BASE_URL/v1/search")))
            .andRespond(withServerError())

        assertThrows<OpenMeteoClientException> { client.searchLocations("Warszawa", 10, "pl") }
    }

    private companion object {
        const val BASE_URL = "https://api.open-meteo.com"
        const val GEOCODING_BASE_URL = "https://geocoding-api.open-meteo.com"

        @Suppress("ktlint:standard:max-line-length")
        const val FORECAST_JSON = """
            {
              "latitude": 52.23,
              "longitude": 21.01,
              "timezone": "Europe/Warsaw",
              "current": {
                "time": "2026-07-25T00:00",
                "temperature_2m": 5.3,
                "relative_humidity_2m": 80,
                "apparent_temperature": 3.1,
                "precipitation": 0.0,
                "weather_code": 3,
                "wind_speed_10m": 12.4
              },
              "hourly": {
                "time": ["2026-07-25T00:00", "2026-07-25T01:00"],
                "temperature_2m": [5.3, 4.8],
                "precipitation_probability": [10, 20],
                "weather_code": [3, 3]
              },
              "daily": {
                "time": ["2026-07-25"],
                "temperature_2m_max": [7.2],
                "temperature_2m_min": [2.1],
                "weather_code": [3],
                "precipitation_sum": [0.0]
              }
            }
        """

        @Suppress("ktlint:standard:max-line-length")
        const val GEOCODING_JSON = """
            {
              "results": [
                {
                  "id": 756135,
                  "name": "Warszawa",
                  "latitude": 52.22977,
                  "longitude": 21.01178,
                  "elevation": 113.0,
                  "feature_code": "PPLC",
                  "country_code": "PL",
                  "timezone": "Europe/Warsaw",
                  "country_id": 798544,
                  "country": "Polska",
                  "admin1": "Województwo Mazowieckie",
                  "admin2": "Warszawa"
                }
              ],
              "generationtime_ms": 0.35
            }
        """
    }
}
