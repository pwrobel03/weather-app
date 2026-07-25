package com.weatherapp.backend.location

import com.weatherapp.backend.openmeteo.OpenMeteoGeocodingResponse
import com.weatherapp.backend.openmeteo.OpenMeteoGeocodingResult

/**
 * Converts the Open-Meteo geocoding wire format into the internal domain model.
 * Returns an empty list if upstream yielded no matches.
 */
fun OpenMeteoGeocodingResponse.toDomain(): List<LocationSearchResult> =
    results?.map { it.toDomain() } ?: emptyList()

private fun OpenMeteoGeocodingResult.toDomain() = LocationSearchResult(
    id = id,
    name = name,
    latitude = latitude,
    longitude = longitude,
    elevation = elevation,
    timezone = timezone,
    countryCode = countryCode,
    country = country,
    admin1 = admin1,
    admin2 = admin2,
)
