package com.weatherapp.backend.boundary

import org.springframework.stereotype.Service

@Service
class TerytResolutionService(private val repository: PowiatBoundaryRepository) {

    fun resolve(latitude: Double, longitude: Double): PowiatBoundary? =
        repository.findContainingPoint(latitude, longitude)

    fun getSimplifiedGeoJson(terytCode: String): PowiatGeoJsonFeature? =
        repository.findSimplifiedGeoJson(terytCode)
}
