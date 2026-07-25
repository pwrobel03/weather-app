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
     * In-memory cache for upstream Open-Meteo responses, avoiding repeated
     * external HTTP requests for the same coordinates within a short timeframe.
     */
    @Bean
    fun openMeteoCacheManager(): CacheManager =
        CaffeineCacheManager(CACHE_NAME).apply {
            setCaffeine(
                Caffeine.newBuilder()
                    .maximumSize(500)
                    .expireAfterWrite(5, TimeUnit.MINUTES),
            )
        }

    companion object {
        const val CACHE_NAME = "open-meteo-forecasts"
    }
}
