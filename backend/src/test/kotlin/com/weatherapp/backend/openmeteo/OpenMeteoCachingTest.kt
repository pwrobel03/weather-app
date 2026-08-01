package com.weatherapp.backend.openmeteo

import org.hamcrest.CoreMatchers.startsWith
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.context.TestConfiguration
import org.springframework.cache.CacheManager
import org.springframework.context.annotation.Bean
import org.springframework.http.MediaType
import org.springframework.test.web.client.MockRestServiceServer
import org.springframework.test.web.client.match.MockRestRequestMatchers.queryParam
import org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo
import org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess
import org.springframework.web.client.RestClient
import kotlin.test.assertEquals

@SpringBootTest(
    classes = [
        OpenMeteoCachingConfig::class,
        OpenMeteoClient::class,
        OpenMeteoCachingTest.Config::class,
    ],
    properties = ["open-meteo.base-url=" + OpenMeteoCachingTest.BASE_URL],
)
class OpenMeteoCachingTest {

    @Autowired
    lateinit var client: OpenMeteoClient

    @Autowired
    lateinit var mockServer: MockRestServiceServer

    @Autowired
    lateinit var cacheManager: CacheManager

    @BeforeEach
    fun resetState() {
        cacheManager.cacheNames.forEach { cacheManager.getCache(it)?.clear() }
        mockServer.reset()
    }

    @Test
    fun `caches upstream response for the same coordinates`() {
        mockServer.expect(requestTo(startsWith("$BASE_URL/v1/forecast")))
            .andExpect(queryParam("latitude", "52.23"))
            .andExpect(queryParam("longitude", "21.01"))
            .andRespond(withSuccess(FORECAST_JSON, MediaType.APPLICATION_JSON))

        val first = client.fetchForecast(52.23, 21.01)
        val second = client.fetchForecast(52.23, 21.01)

        assertEquals(first.latitude, second.latitude)
        assertEquals(first.current?.temperature2m, second.current?.temperature2m)
        mockServer.verify()
    }

    @Test
    fun `queries upstream separately for different coordinates`() {
        mockServer.expect(requestTo(startsWith("$BASE_URL/v1/forecast")))
            .andExpect(queryParam("latitude", "52.23"))
            .andExpect(queryParam("longitude", "21.01"))
            .andRespond(withSuccess(FORECAST_JSON, MediaType.APPLICATION_JSON))

        mockServer.expect(requestTo(startsWith("$BASE_URL/v1/forecast")))
            .andExpect(queryParam("latitude", "50.06"))
            .andExpect(queryParam("longitude", "19.94"))
            .andRespond(withSuccess(FORECAST_JSON_KRAKOW, MediaType.APPLICATION_JSON))

        val warsaw = client.fetchForecast(52.23, 21.01)
        val krakow = client.fetchForecast(50.06, 19.94)

        assertEquals(52.23, warsaw.latitude)
        assertEquals(50.06, krakow.latitude)
        mockServer.verify()
    }

    @TestConfiguration
    @EnableConfigurationProperties(OpenMeteoProperties::class)
    class Config {
        @Bean
        fun mockServerAndBuilder(): Pair<RestClient.Builder, MockRestServiceServer> {
            val builder = RestClient.builder()
            val server = MockRestServiceServer.bindTo(builder).build()
            return builder to server
        }

        @Bean
        fun restClientBuilder(pair: Pair<RestClient.Builder, MockRestServiceServer>): RestClient.Builder =
            pair.first

        @Bean
        fun mockRestServiceServer(pair: Pair<RestClient.Builder, MockRestServiceServer>): MockRestServiceServer =
            pair.second
    }

    companion object {
        const val BASE_URL = "https://api.open-meteo.com"

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
        const val FORECAST_JSON_KRAKOW = """
            {
              "latitude": 50.06,
              "longitude": 19.94,
              "timezone": "Europe/Warsaw",
              "current": {
                "time": "2026-07-25T00:00",
                "temperature_2m": 6.1,
                "relative_humidity_2m": 75,
                "apparent_temperature": 4.0,
                "precipitation": 0.0,
                "weather_code": 2,
                "wind_speed_10m": 10.0
              },
              "hourly": {
                "time": ["2026-07-25T00:00", "2026-07-25T01:00"],
                "temperature_2m": [6.1, 5.5],
                "precipitation_probability": [5, 10],
                "weather_code": [2, 2]
              },
              "daily": {
                "time": ["2026-07-25"],
                "temperature_2m_max": [8.5],
                "temperature_2m_min": [3.0],
                "weather_code": [2],
                "precipitation_sum": [0.0]
              }
            }
        """
    }
}
