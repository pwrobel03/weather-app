package com.weatherapp.backend.forecast

import java.time.LocalDate
import java.time.LocalDateTime

data class Forecast(
    val latitude: Double,
    val longitude: Double,
    val timezone: String,
    val current: CurrentConditions,
    val hourly: List<HourlyForecastEntry>,
    val daily: List<DailyForecastEntry>,
)

data class CurrentConditions(
    val observedAt: LocalDateTime,
    val temperatureCelsius: Double,
    val apparentTemperatureCelsius: Double,
    val relativeHumidityPercent: Int,
    val precipitationMm: Double,
    val windSpeedKmh: Double,
    val weatherCode: Int,
)

data class HourlyForecastEntry(
    val time: LocalDateTime,
    val temperatureCelsius: Double,
    val precipitationProbabilityPercent: Int,
    val weatherCode: Int,
)

data class DailyForecastEntry(
    val date: LocalDate,
    val temperatureMaxCelsius: Double,
    val temperatureMinCelsius: Double,
    val precipitationSumMm: Double,
    val weatherCode: Int,
)
