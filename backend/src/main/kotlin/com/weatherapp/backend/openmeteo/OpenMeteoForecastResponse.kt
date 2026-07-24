package com.weatherapp.backend.openmeteo

import com.fasterxml.jackson.annotation.JsonProperty

data class OpenMeteoForecastResponse(
    val latitude: Double,
    val longitude: Double,
    val timezone: String,
    val current: CurrentWeather?,
    val hourly: HourlyForecast?,
    val daily: DailyForecast?,
)

data class CurrentWeather(
    val time: String,
    @JsonProperty("temperature_2m") val temperature2m: Double,
    @JsonProperty("relative_humidity_2m") val relativeHumidity2m: Int,
    @JsonProperty("apparent_temperature") val apparentTemperature: Double,
    val precipitation: Double,
    @JsonProperty("weather_code") val weatherCode: Int,
    @JsonProperty("wind_speed_10m") val windSpeed10m: Double,
)

data class HourlyForecast(
    val time: List<String>,
    @JsonProperty("temperature_2m") val temperature2m: List<Double>,
    @JsonProperty("precipitation_probability") val precipitationProbability: List<Int>,
    @JsonProperty("weather_code") val weatherCode: List<Int>,
)

data class DailyForecast(
    val time: List<String>,
    @JsonProperty("temperature_2m_max") val temperature2mMax: List<Double>,
    @JsonProperty("temperature_2m_min") val temperature2mMin: List<Double>,
    @JsonProperty("weather_code") val weatherCode: List<Int>,
    @JsonProperty("precipitation_sum") val precipitationSum: List<Double>,
)
