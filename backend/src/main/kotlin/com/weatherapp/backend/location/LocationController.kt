package com.weatherapp.backend.location

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
@Tag(name = "Location", description = "Geocoding and location search endpoints (Open-Meteo Geocoding API integration)")
class LocationController(private val locationService: LocationService) {

    @Operation(
        summary = "Search locations by name",
        description = "Returns matching locations with geocoded coordinates and administrative divisions, cached for 24 hours. Queries under 2 characters return immediately with an empty list.",
        responses = [
            ApiResponse(responseCode = "200", description = "Successful geocoding search"),
            ApiResponse(
                responseCode = "502",
                description = "Upstream Open-Meteo Geocoding API failure",
                content = [Content(schema = Schema(implementation = Map::class))],
            ),
        ],
    )
    @GetMapping("/api/locations/search")
    fun search(
        @Parameter(description = "Location name prefix to search for", example = "Warsz")
        @RequestParam
        query: String,
        @Parameter(description = "Maximum number of search results to return", example = "10", required = false)
        @RequestParam(defaultValue = "10")
        limit: Int = 10,
        @Parameter(description = "Language for location and administrative names (e.g. 'pl' or 'en')", example = "pl", required = false)
        @RequestParam(defaultValue = "pl")
        language: String = "pl",
    ): ResponseEntity<List<LocationSearchResult>> =
        ResponseEntity.ok()
            .cacheControl(CacheControl.maxAge(SEARCH_CACHE_TTL))
            .body(locationService.searchLocations(query, limit, language))

    @ExceptionHandler(OpenMeteoClientException::class)
    fun handleUpstreamFailure(ex: OpenMeteoClientException): ResponseEntity<Map<String, String?>> =
        ResponseEntity.status(HttpStatus.BAD_GATEWAY)
            .cacheControl(CacheControl.noStore())
            .body(mapOf("error" to ex.message))

    private companion object {
        // Geocoding coordinates and city boundaries rarely change; cache HTTP responses for 24 hours.
        val SEARCH_CACHE_TTL: Duration = Duration.ofHours(24)
    }
}
