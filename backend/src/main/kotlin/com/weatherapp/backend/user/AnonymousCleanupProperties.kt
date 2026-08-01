package com.weatherapp.backend.user

import org.springframework.boot.context.properties.ConfigurationProperties
import java.time.Duration

/**
 * Collection of anonymous users no device can reach any more.
 *
 * The interval is a day because nothing here is urgent: these rows are dead,
 * not dangerous, and a sweep that runs while nobody is looking is preferable to
 * one competing with traffic.
 */
@ConfigurationProperties(prefix = "anonymous-cleanup")
data class AnonymousCleanupProperties(
    val enabled: Boolean = true,
    val interval: Duration = Duration.ofDays(1),
    val initialDelay: Duration = Duration.ofMinutes(5),
)
