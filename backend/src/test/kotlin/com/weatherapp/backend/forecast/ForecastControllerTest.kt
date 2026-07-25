package com.weatherapp.backend.forecast

import com.weatherapp.backend.openmeteo.CurrentWeather
import com.weatherapp.backend.openmeteo.DailyForecast
import com.weatherapp.backend.openmeteo.HourlyForecast
import com.weatherapp.backend.openmeteo.OpenMeteoClient
import com.weatherapp.backend.openmeteo.OpenMeteoClientException
import com.weatherapp.backend.openmeteo.OpenMeteoForecastResponse
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.web.server.LocalServerPort
import org.springframework.cache.CacheManager
import org.springframework.http.HttpHeaders
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.web.client.HttpServerErrorException
import org.springframework.web.client.RestClient
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

@SpringBootTest(
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = [
        "spring.autoconfigure.exclude=" +
            "org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration," +
            "org.springframework.boot.flyway.autoconfigure.FlywayAutoConfiguration",
    ],
)
class ForecastControllerTest {

    @LocalServerPort
    var port: Int = 0

    @MockitoBean
    lateinit var openMeteoClient: OpenMeteoClient

    @Autowired
    lateinit var cacheManager: CacheManager

    @BeforeEach
    fun clearCaches() {
        cacheManager.cacheNames.forEach { cacheManager.getCache(it)?.clear() }
    }

    @Test
    fun `returns current conditions for a coordinate`() {
        stubUpstreamResponse()

        val body = get("/api/forecast/current?latitude=52.23&longitude=21.01")

        assertTrue(body.contains("\"temperatureCelsius\":5.3"))
        assertTrue(body.contains("\"weatherCode\":3"))
    }

    @Test
    fun `returns hourly forecast entries for a coordinate`() {
        stubUpstreamResponse()

        val body = get("/api/forecast/hourly?latitude=52.23&longitude=21.01")

        assertTrue(body.contains("\"temperatureCelsius\":5.3"))
        assertTrue(body.contains("\"temperatureCelsius\":4.8"))
        assertTrue(body.contains("\"precipitationProbabilityPercent\":20"))
    }

    @Test
    fun `returns daily forecast entries for a coordinate`() {
        stubUpstreamResponse()

        val body = get("/api/forecast/daily?latitude=52.23&longitude=21.01")

        assertTrue(body.contains("\"temperatureMaxCelsius\":7.2"))
        assertTrue(body.contains("\"temperatureMinCelsius\":2.1"))
    }

    @Test
    fun `sets cache-control and supports conditional requests via etag`() {
        stubUpstreamResponse()
        val client = RestClient.create("http://localhost:$port")

        val first = client.get()
            .uri("/api/forecast/current?latitude=52.23&longitude=21.01")
            .retrieve()
            .toEntity(String::class.java)

        assertEquals("max-age=300", first.headers.cacheControl)
        val etag = first.headers.eTag
        assertNotNull(etag)

        val second = client.get()
            .uri("/api/forecast/current?latitude=52.23&longitude=21.01")
            .header(HttpHeaders.IF_NONE_MATCH, etag)
            .retrieve()
            .toBodilessEntity()

        assertEquals(304, second.statusCode.value())
    }

    @Test
    fun `returns 502 when the upstream client fails`() {
        whenever(openMeteoClient.fetchForecast(any(), any()))
            .thenThrow(OpenMeteoClientException("boom"))

        val exception = org.junit.jupiter.api.assertThrows<HttpServerErrorException> {
            get("/api/forecast/current?latitude=52.23&longitude=21.01")
        }

        assertEquals(502, exception.statusCode.value())
    }

    private fun get(uri: String): String =
        RestClient.create("http://localhost:$port").get().uri(uri).retrieve().body(String::class.java)!!

    private fun stubUpstreamResponse() {
        whenever(openMeteoClient.fetchForecast(any(), any())).thenReturn(
            OpenMeteoForecastResponse(
                latitude = 52.23,
                longitude = 21.01,
                timezone = "Europe/Warsaw",
                current = CurrentWeather(
                    time = "2026-07-25T00:00",
                    temperature2m = 5.3,
                    relativeHumidity2m = 80,
                    apparentTemperature = 3.1,
                    precipitation = 0.0,
                    weatherCode = 3,
                    windSpeed10m = 12.4,
                ),
                hourly = HourlyForecast(
                    time = listOf("2026-07-25T00:00", "2026-07-25T01:00"),
                    temperature2m = listOf(5.3, 4.8),
                    precipitationProbability = listOf(10, 20),
                    weatherCode = listOf(3, 3),
                ),
                daily = DailyForecast(
                    time = listOf("2026-07-25"),
                    temperature2mMax = listOf(7.2),
                    temperature2mMin = listOf(2.1),
                    weatherCode = listOf(3),
                    precipitationSum = listOf(0.0),
                ),
            ),
        )
    }
}
