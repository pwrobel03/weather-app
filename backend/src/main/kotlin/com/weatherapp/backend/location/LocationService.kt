package com.weatherapp.backend.location

import com.weatherapp.backend.openmeteo.OpenMeteoClient
import org.springframework.stereotype.Service

@Service
class LocationService(private val openMeteoClient: OpenMeteoClient) {

    fun searchLocations(query: String, limit: Int = 10, language: String = "pl"): List<LocationSearchResult> {
        val trimmed = query.trim()
        if (trimmed.length < 2) {
            return emptyList()
        }
        return openMeteoClient.searchLocations(trimmed, limit, language).toDomain()
    }
}
