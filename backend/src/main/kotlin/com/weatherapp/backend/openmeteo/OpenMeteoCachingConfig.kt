package com.weatherapp.backend.openmeteo

import com.github.benmanes.caffeine.cache.Caffeine
import org.springframework.cache.CacheManager
import org.springframework.cache.annotation.EnableCaching
import org.springframework.cache.caffeine.CaffeineCacheManager
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import java.util.concurrent.TimeUnit

@Configuration
@EnableCaching
class OpenMeteoCachingConfig {

    /**
     * In-memory cache for upstream Open-Meteo responses. Forecasts and
     * geocoding results are cached with different TTLs — forecasts drift
     * within minutes, geocoded coordinates barely ever change — so each
     * cache gets its own Caffeine spec rather than sharing one.
     */
    @Bean
    fun openMeteoCacheManager(): CacheManager =
        CaffeineCacheManager().apply {
            registerCustomCache(
                CACHE_NAME,
                Caffeine.newBuilder()
                    .maximumSize(500)
                    .expireAfterWrite(5, TimeUnit.MINUTES)
                    .build(),
            )
            registerCustomCache(
                GEOCODING_CACHE_NAME,
                Caffeine.newBuilder()
                    .maximumSize(500)
                    .expireAfterWrite(24, TimeUnit.HOURS)
                    .build(),
            )
        }

    companion object {
        const val CACHE_NAME = "open-meteo-forecasts"
        const val GEOCODING_CACHE_NAME = "open-meteo-geocoding"
    }
}
