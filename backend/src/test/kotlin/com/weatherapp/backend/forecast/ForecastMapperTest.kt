package com.weatherapp.backend.forecast

import com.weatherapp.backend.openmeteo.CurrentWeather
import com.weatherapp.backend.openmeteo.DailyForecast
import com.weatherapp.backend.openmeteo.HourlyForecast
import com.weatherapp.backend.openmeteo.OpenMeteoForecastResponse
import org.junit.jupiter.api.Test
import java.time.LocalDate
import java.time.LocalDateTime
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class ForecastMapperTest {

    @Test
    fun `maps a full open-meteo response to the domain model`() {
        val response = OpenMeteoForecastResponse(
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
        )

        val forecast = response.toDomain()

        assertEquals(52.23, forecast.latitude)
        assertEquals(LocalDateTime.parse("2026-07-25T00:00"), forecast.current.observedAt)
        assertEquals(5.3, forecast.current.temperatureCelsius)
        assertEquals(2, forecast.hourly.size)
        assertEquals(4.8, forecast.hourly[1].temperatureCelsius)
        assertEquals(1, forecast.daily.size)
        assertEquals(LocalDate.parse("2026-07-25"), forecast.daily[0].date)
        assertEquals(7.2, forecast.daily[0].temperatureMaxCelsius)
    }

    @Test
    fun `fails loudly when current is missing`() {
        val response = OpenMeteoForecastResponse(
            latitude = 52.23,
            longitude = 21.01,
            timezone = "Europe/Warsaw",
            current = null,
            hourly = HourlyForecast(emptyList(), emptyList(), emptyList(), emptyList()),
            daily = DailyForecast(emptyList(), emptyList(), emptyList(), emptyList(), emptyList()),
        )

        assertFailsWith<IncompleteForecastResponseException> { response.toDomain() }
    }
}
