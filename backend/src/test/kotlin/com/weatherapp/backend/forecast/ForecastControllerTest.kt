package com.weatherapp.backend.forecast

import com.weatherapp.backend.openmeteo.CurrentWeather
import com.weatherapp.backend.openmeteo.DailyForecast
import com.weatherapp.backend.openmeteo.HourlyForecast
import com.weatherapp.backend.openmeteo.OpenMeteoClient
import com.weatherapp.backend.openmeteo.OpenMeteoClientException
import com.weatherapp.backend.openmeteo.OpenMeteoForecastResponse
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.whenever
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.web.server.LocalServerPort
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.web.client.HttpServerErrorException
import org.springframework.web.client.RestClient
import kotlin.test.assertEquals
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

    @Test
    fun `returns current conditions for a coordinate`() {
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
                hourly = HourlyForecast(emptyList(), emptyList(), emptyList(), emptyList()),
                daily = DailyForecast(emptyList(), emptyList(), emptyList(), emptyList(), emptyList()),
            ),
        )

        val client = RestClient.create("http://localhost:$port")
        val body = client.get()
            .uri("/api/forecast/current?latitude=52.23&longitude=21.01")
            .retrieve()
            .body(String::class.java)

        assertTrue(body!!.contains("\"temperatureCelsius\":5.3"))
        assertTrue(body.contains("\"weatherCode\":3"))
    }

    @Test
    fun `returns 502 when the upstream client fails`() {
        whenever(openMeteoClient.fetchForecast(any(), any()))
            .thenThrow(OpenMeteoClientException("boom"))

        val client = RestClient.create("http://localhost:$port")
        val exception = org.junit.jupiter.api.assertThrows<HttpServerErrorException> {
            client.get()
                .uri("/api/forecast/current?latitude=52.23&longitude=21.01")
                .retrieve()
                .body(String::class.java)
        }

        assertEquals(502, exception.statusCode.value())
    }
}
