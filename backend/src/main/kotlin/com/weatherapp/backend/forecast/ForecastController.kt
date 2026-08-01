package com.weatherapp.backend.forecast

import com.weatherapp.backend.openmeteo.OpenMeteoClientException
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.Parameter
import io.swagger.v3.oas.annotations.media.Content
import io.swagger.v3.oas.annotations.media.Schema
import io.swagger.v3.oas.annotations.responses.ApiResponse
import io.swagger.v3.oas.annotations.tags.Tag
import org.springframework.http.CacheControl
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import java.time.Duration

@RestController
@Tag(name = "Forecast", description = "Weather forecast and conditions endpoints (Open-Meteo integration)")
class ForecastController(private val forecastService: ForecastService) {

    @Operation(
        summary = "Get current weather conditions",
        description = "Returns current observed weather conditions for the given coordinates, cached for 5 minutes.",
        responses = [
            ApiResponse(responseCode = "200", description = "Successful forecast retrieval"),
            ApiResponse(
                responseCode = "502",
                description = "Upstream Open-Meteo API failure or incomplete response",
                content = [Content(schema = Schema(implementation = Map::class))],
            ),
        ],
    )
    @GetMapping("/api/forecast/current")
    fun current(
        @Parameter(description = "Latitude in decimal degrees", example = "52.23")
        @RequestParam
        latitude: Double,
        @Parameter(description = "Longitude in decimal degrees", example = "21.01")
        @RequestParam
        longitude: Double,
    ): ResponseEntity<CurrentConditions> =
        ResponseEntity.ok()
            .cacheControl(CacheControl.maxAge(CURRENT_CACHE_TTL))
            .body(forecastService.getForecast(latitude, longitude).current)

    @Operation(
        summary = "Get hourly weather forecast",
        description = "Returns hourly weather forecast entries for the given coordinates, cached for 30 minutes.",
        responses = [
            ApiResponse(responseCode = "200", description = "Successful forecast retrieval"),
            ApiResponse(
                responseCode = "502",
                description = "Upstream Open-Meteo API failure or incomplete response",
                content = [Content(schema = Schema(implementation = Map::class))],
            ),
        ],
    )
    @GetMapping("/api/forecast/hourly")
    fun hourly(
        @Parameter(description = "Latitude in decimal degrees", example = "52.23")
        @RequestParam
        latitude: Double,
        @Parameter(description = "Longitude in decimal degrees", example = "21.01")
        @RequestParam
        longitude: Double,
    ): ResponseEntity<List<HourlyForecastEntry>> =
        ResponseEntity.ok()
            .cacheControl(CacheControl.maxAge(HOURLY_CACHE_TTL))
            .body(forecastService.getForecast(latitude, longitude).hourly)

    @Operation(
        summary = "Get daily weather forecast",
        description = "Returns daily weather forecast entries for the given coordinates, cached for 6 hours.",
        responses = [
            ApiResponse(responseCode = "200", description = "Successful forecast retrieval"),
            ApiResponse(
                responseCode = "502",
                description = "Upstream Open-Meteo API failure or incomplete response",
                content = [Content(schema = Schema(implementation = Map::class))],
            ),
        ],
    )
    @GetMapping("/api/forecast/daily")
    fun daily(
        @Parameter(description = "Latitude in decimal degrees", example = "52.23")
        @RequestParam
        latitude: Double,
        @Parameter(description = "Longitude in decimal degrees", example = "21.01")
        @RequestParam
        longitude: Double,
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
