package com.weatherapp.backend.boundary

import org.springframework.cache.annotation.Cacheable
import org.springframework.stereotype.Service

@Service
class TerytResolutionService(private val repository: PowiatBoundaryRepository) {

    @Cacheable(
        cacheNames = [BoundaryCachingConfig.CACHE_NAME],
        cacheManager = BoundaryCachingConfig.TERYT_CACHE_MANAGER,
    )
    fun resolve(latitude: Double, longitude: Double): PowiatBoundary? =
        repository.findContainingPoint(latitude, longitude)

    fun getSimplifiedGeoJson(terytCode: String): PowiatGeoJsonFeature? =
        repository.findSimplifiedGeoJson(terytCode)
}
