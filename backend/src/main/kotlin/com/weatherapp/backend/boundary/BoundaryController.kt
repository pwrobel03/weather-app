package com.weatherapp.backend.boundary

import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.Parameter
import io.swagger.v3.oas.annotations.responses.ApiResponse
import io.swagger.v3.oas.annotations.tags.Tag
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.context.request.WebRequest

@RestController
@Tag(name = "Boundary", description = "Coordinate-to-TERYT resolution (powiat lookup)")
class BoundaryController(private val terytResolutionService: TerytResolutionService) {

    @Operation(
        summary = "Resolve coordinates to a powiat",
        description = "Returns the powiat (district) containing the given coordinates, identified by its TERYT code.",
        responses = [
            ApiResponse(responseCode = "200", description = "Coordinates resolved to a powiat"),
            ApiResponse(responseCode = "404", description = "Coordinates fall outside all known powiat boundaries"),
        ],
    )
    @GetMapping("/api/boundaries/resolve")
    fun resolve(
        @Parameter(description = "Latitude in decimal degrees", example = "52.2297")
        @RequestParam
        latitude: Double,
        @Parameter(description = "Longitude in decimal degrees", example = "21.0122")
        @RequestParam
        longitude: Double,
    ): ResponseEntity<PowiatBoundary> =
        terytResolutionService.resolve(latitude, longitude)
            ?.let { ResponseEntity.ok(it) }
            ?: ResponseEntity.notFound().build()

    @Operation(
        summary = "Get several powiats' boundaries as one GeoJSON FeatureCollection",
        description =
            "Returns simplified boundaries for the given TERYT codes in a single response. " +
                "A single IMGW warning can cover more than a hundred powiats, and one request " +
                "per powiat would mean the map issuing a hundred round trips for geometry that " +
                "never changes.",
        responses = [
            ApiResponse(responseCode = "200", description = "FeatureCollection; unknown codes are simply absent"),
            ApiResponse(responseCode = "400", description = "Too many codes requested"),
        ],
    )
    @GetMapping("/api/boundaries/geojson")
    fun geojsonBatch(
        @Parameter(description = "Powiat TERYT codes", example = "1465,1401,3064")
        @RequestParam(name = "teryt")
        terytCodes: List<String>,
        request: WebRequest,
    ): ResponseEntity<PowiatGeoJsonFeatureCollection> {
        val version = terytResolutionService.datasetVersion()
        // Validate before querying: the whole point is not to build hundreds of
        // kilobytes of geometry the client already has.
        BoundaryHttpCaching.notModified<PowiatGeoJsonFeatureCollection>(
            request,
            version,
            terytCodes.sorted().joinToString(","),
        )?.let { return it }

        return BoundaryHttpCaching.cacheable(terytResolutionService.getSimplifiedGeoJson(terytCodes), version)
    }

    @Operation(
        summary = "Get a powiat's boundary as GeoJSON",
        description = "Returns a simplified GeoJSON Feature for the powiat with the given TERYT code, for map rendering.",
        responses = [
            ApiResponse(responseCode = "200", description = "GeoJSON Feature for the powiat"),
            ApiResponse(responseCode = "404", description = "No powiat with the given TERYT code"),
        ],
    )
    @GetMapping("/api/boundaries/{terytCode}/geojson")
    fun geojson(
        @Parameter(description = "Powiat TERYT code", example = "1465")
        @PathVariable
        terytCode: String,
        request: WebRequest,
    ): ResponseEntity<PowiatGeoJsonFeature> {
        val version = terytResolutionService.datasetVersion()
        BoundaryHttpCaching.notModified<PowiatGeoJsonFeature>(request, version, terytCode)
            ?.let { return it }

        val feature = terytResolutionService.getSimplifiedGeoJson(terytCode)
            ?: return ResponseEntity.notFound().build()

        return BoundaryHttpCaching.cacheable(feature, version)
    }

    /** An over-long code list is the caller's mistake, not a server fault. */
    @ExceptionHandler(IllegalArgumentException::class)
    fun handleTooManyCodes(ex: IllegalArgumentException): ResponseEntity<Map<String, String?>> =
        ResponseEntity.badRequest().body(mapOf("error" to ex.message))
}
