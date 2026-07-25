package com.weatherapp.backend.boundary

import com.fasterxml.jackson.annotation.JsonRawValue

data class PowiatBoundary(
    val terytCode: String,
    val name: String,
    val voivodeship: String,
)

/**
 * Standard GeoJSON Feature. `geometry` is a pre-serialized JSON string
 * straight out of PostGIS's `ST_AsGeoJSON` — `@JsonRawValue` embeds it
 * verbatim instead of escaping it as a nested JSON string.
 */
data class PowiatGeoJsonFeature(
    val properties: Properties,
    @JsonRawValue val geometry: String,
    val type: String = "Feature",
) {
    data class Properties(
        val terytCode: String,
        val name: String,
        val voivodeship: String,
    )
}
