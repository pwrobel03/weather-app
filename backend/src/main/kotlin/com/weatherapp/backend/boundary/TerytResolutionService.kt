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

    /**
     * Boundaries for many powiats at once.
     *
     * Deduplicates before querying and caps the request: the codes come from a
     * client, and nothing stops one from asking for the same code a thousand
     * times or for every powiat in the country in a single URL.
     */
    fun getSimplifiedGeoJson(terytCodes: List<String>): PowiatGeoJsonFeatureCollection {
        val distinct = terytCodes.map(String::trim).filter(String::isNotEmpty).distinct()
        require(distinct.size <= MAX_CODES_PER_REQUEST) {
            "at most $MAX_CODES_PER_REQUEST teryt codes per request, got ${distinct.size}"
        }

        return PowiatGeoJsonFeatureCollection(repository.findSimplifiedGeoJson(distinct))
    }

    /** Every powiat, for the map's base layer. */
    fun getAllSimplifiedGeoJson(): PowiatGeoJsonFeatureCollection =
        PowiatGeoJsonFeatureCollection(repository.findAllSimplifiedGeoJson())

    /**
     * An opaque tag identifying the current boundary dataset, for HTTP
     * validation. Null when nothing has been imported yet - there is no
     * version of an empty dataset worth caching.
     */
    fun datasetVersion(): String? = repository.datasetVersion()?.toEpochMilli()?.toString(16)

    private companion object {
        /**
         * Poland has 380 powiats, so this allows every one of them at once and
         * still refuses a URL built to be pathological.
         */
        const val MAX_CODES_PER_REQUEST = 400
    }
}
