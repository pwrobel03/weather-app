package com.weatherapp.backend.forecast

import com.weatherapp.backend.openmeteo.OpenMeteoClientException
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController

@RestController
class ForecastController(private val forecastService: ForecastService) {

    @GetMapping("/api/forecast/current")
    fun current(@RequestParam latitude: Double, @RequestParam longitude: Double): CurrentConditions =
        forecastService.getForecast(latitude, longitude).current

    @GetMapping("/api/forecast/hourly")
    fun hourly(@RequestParam latitude: Double, @RequestParam longitude: Double): List<HourlyForecastEntry> =
        forecastService.getForecast(latitude, longitude).hourly

    @GetMapping("/api/forecast/daily")
    fun daily(@RequestParam latitude: Double, @RequestParam longitude: Double): List<DailyForecastEntry> =
        forecastService.getForecast(latitude, longitude).daily

    @ExceptionHandler(OpenMeteoClientException::class, IncompleteForecastResponseException::class)
    @ResponseStatus(HttpStatus.BAD_GATEWAY)
    fun handleUpstreamFailure(ex: RuntimeException): Map<String, String?> = mapOf("error" to ex.message)
}
