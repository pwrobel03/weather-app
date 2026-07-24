package com.weatherapp.backend.forecast

import com.weatherapp.backend.openmeteo.CurrentWeather
import com.weatherapp.backend.openmeteo.DailyForecast as OpenMeteoDailyForecast
import com.weatherapp.backend.openmeteo.HourlyForecast as OpenMeteoHourlyForecast
import com.weatherapp.backend.openmeteo.OpenMeteoForecastResponse
import java.time.LocalDate
import java.time.LocalDateTime

/**
 * Converts the Open-Meteo wire format into the internal domain model. Fails
 * loudly on missing blocks rather than silently returning empty data — our
 * own client always requests current/hourly/daily together, so a missing
 * block means the request or the upstream contract changed.
 */
fun OpenMeteoForecastResponse.toDomain(): Forecast {
    val current = current ?: throw IncompleteForecastResponseException("Open-Meteo response is missing 'current' data")
    val hourly = hourly ?: throw IncompleteForecastResponseException("Open-Meteo response is missing 'hourly' data")
    val daily = daily ?: throw IncompleteForecastResponseException("Open-Meteo response is missing 'daily' data")

    return Forecast(
        latitude = latitude,
        longitude = longitude,
        timezone = timezone,
        current = current.toDomain(),
        hourly = hourly.toDomainEntries(),
        daily = daily.toDomainEntries(),
    )
}

private fun CurrentWeather.toDomain() = CurrentConditions(
    observedAt = LocalDateTime.parse(time),
    temperatureCelsius = temperature2m,
    apparentTemperatureCelsius = apparentTemperature,
    relativeHumidityPercent = relativeHumidity2m,
    precipitationMm = precipitation,
    windSpeedKmh = windSpeed10m,
    weatherCode = weatherCode,
)

private fun OpenMeteoHourlyForecast.toDomainEntries(): List<HourlyForecastEntry> =
    time.indices.map { i ->
        HourlyForecastEntry(
            time = LocalDateTime.parse(time[i]),
            temperatureCelsius = temperature2m[i],
            precipitationProbabilityPercent = precipitationProbability[i],
            weatherCode = weatherCode[i],
        )
    }

private fun OpenMeteoDailyForecast.toDomainEntries(): List<DailyForecastEntry> =
    time.indices.map { i ->
        DailyForecastEntry(
            date = LocalDate.parse(time[i]),
            temperatureMaxCelsius = temperature2mMax[i],
            temperatureMinCelsius = temperature2mMin[i],
            precipitationSumMm = precipitationSum[i],
            weatherCode = weatherCode[i],
        )
    }
