package com.weatherapp.backend.forecast

import com.weatherapp.backend.openmeteo.OpenMeteoClientException
import org.springframework.http.CacheControl
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import java.time.Duration

@RestController
class ForecastController(private val forecastService: ForecastService) {

    @GetMapping("/api/forecast/current")
    fun current(@RequestParam latitude: Double, @RequestParam longitude: Double): ResponseEntity<CurrentConditions> =
        ResponseEntity.ok()
            .cacheControl(CacheControl.maxAge(CURRENT_CACHE_TTL))
            .body(forecastService.getForecast(latitude, longitude).current)

    @GetMapping("/api/forecast/hourly")
    fun hourly(
        @RequestParam latitude: Double,
        @RequestParam longitude: Double,
    ): ResponseEntity<List<HourlyForecastEntry>> =
        ResponseEntity.ok()
            .cacheControl(CacheControl.maxAge(HOURLY_CACHE_TTL))
            .body(forecastService.getForecast(latitude, longitude).hourly)

    @GetMapping("/api/forecast/daily")
    fun daily(
        @RequestParam latitude: Double,
        @RequestParam longitude: Double,
    ): ResponseEntity<List<DailyForecastEntry>> =
        ResponseEntity.ok()
            .cacheControl(CacheControl.maxAge(DAILY_CACHE_TTL))
            .body(forecastService.getForecast(latitude, longitude).daily)

    @ExceptionHandler(OpenMeteoClientException::class, IncompleteForecastResponseException::class)
    fun handleUpstreamFailure(ex: RuntimeException): ResponseEntity<Map<String, String?>> =
        ResponseEntity.status(HttpStatus.BAD_GATEWAY)
            .cacheControl(CacheControl.noStore())
            .body(mapOf("error" to ex.message))

    private companion object {
        // Tuned to Open-Meteo's own refresh cadence, not chosen arbitrarily:
        // current conditions update roughly hourly upstream, hourly/daily
        // forecasts drift more slowly.
        val CURRENT_CACHE_TTL: Duration = Duration.ofMinutes(5)
        val HOURLY_CACHE_TTL: Duration = Duration.ofMinutes(30)
        val DAILY_CACHE_TTL: Duration = Duration.ofHours(6)
    }
}
