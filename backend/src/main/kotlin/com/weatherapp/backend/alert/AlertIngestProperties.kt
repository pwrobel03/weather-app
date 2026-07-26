package com.weatherapp.backend.alert

import org.springframework.boot.context.properties.ConfigurationProperties
import java.time.Duration

/**
 * IMGW publishes warnings a handful of times a day, so polling exists to bound
 * how late a warning can arrive, not to catch a fast-moving stream. Ten
 * minutes keeps worst-case lateness small against a feed that is free and
 * unmetered, without hammering a public service.
 */
@ConfigurationProperties(prefix = "alert-ingest")
data class AlertIngestProperties(
    val enabled: Boolean = true,
    val interval: Duration = Duration.ofMinutes(10),
    val initialDelay: Duration = Duration.ofSeconds(30),
)
