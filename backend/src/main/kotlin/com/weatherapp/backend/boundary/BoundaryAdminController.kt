package com.weatherapp.backend.boundary

import com.weatherapp.backend.savedlocation.SavedLocationRepository
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.tags.Tag
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.cache.CacheManager
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RestController

data class TerytRefreshResult(val updatedLocations: Int)

/**
 * Repairs the `saved_location.teryt_code` denormalisation after the powiat
 * boundaries have been replaced (see `infra/scripts/import-powiat-boundaries.sh`).
 *
 * This lives in the backend rather than at the end of the import SQL for one
 * reason: only a JVM-side operation can also evict the `teryt-resolution`
 * cache. A pure SQL step would leave the database correct while the running
 * application kept serving stale resolutions for up to the 24h cache TTL.
 *
 * Rebuilding is event-driven, not scheduled: the only thing that invalidates a
 * saved code is a boundary change, and that is a known moment. A nightly job
 * would recompute identical values 364 days a year and still be up to a day
 * late on the one day it mattered.
 */
@RestController
@Tag(name = "Admin", description = "Administrative maintenance operations")
class BoundaryAdminController(
    private val savedLocationRepository: SavedLocationRepository,
    @Qualifier(BoundaryCachingConfig.TERYT_CACHE_MANAGER) private val terytCacheManager: CacheManager,
) {

    @Operation(
        summary = "Rebuild TERYT codes for all saved locations",
        description = "Re-resolves every saved location against the current powiat boundaries and clears the TERYT resolution cache. Intended to run right after a boundary import.",
    )
    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/api/admin/boundaries/refresh")
    fun refreshTerytCodes(): TerytRefreshResult {
        val updated = savedLocationRepository.reresolveAllTerytCodes()
        terytCacheManager.getCache(BoundaryCachingConfig.CACHE_NAME)?.clear()
        return TerytRefreshResult(updatedLocations = updated)
    }
}
