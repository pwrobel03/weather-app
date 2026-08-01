package com.weatherapp.backend.boundary

import com.github.benmanes.caffeine.cache.Caffeine
import org.springframework.cache.CacheManager
import org.springframework.cache.annotation.EnableCaching
import org.springframework.cache.caffeine.CaffeineCacheManager
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import java.util.concurrent.TimeUnit

@Configuration
@EnableCaching
class BoundaryCachingConfig {

    /**
     * TERYT resolution is deterministic - the same coordinates always map to
     * the same powiat, and administrative boundaries essentially never change
     * during the app's lifetime, so this is cached far longer (and more
     * generously sized) than the volatile upstream weather-data caches.
     */
    @Bean(TERYT_CACHE_MANAGER)
    fun terytCacheManager(): CacheManager =
        CaffeineCacheManager().apply {
            registerCustomCache(
                CACHE_NAME,
                Caffeine.newBuilder()
                    .maximumSize(5000)
                    .expireAfterWrite(24, TimeUnit.HOURS)
                    .build(),
            )
        }

    companion object {
        const val CACHE_NAME = "teryt-resolution"
        const val TERYT_CACHE_MANAGER = "terytCacheManager"
    }
}
