package com.weatherapp.backend.auth

import org.springframework.boot.context.properties.ConfigurationProperties
import java.time.Duration

/**
 * Fixed-window limits for the unauthenticated auth endpoints, keyed by client
 * address. Defaults are tuned for brute-force resistance, not for convenience:
 * a human logging in mistypes a password a handful of times, a credential
 * stuffer does not.
 *
 * Refresh is deliberately far more generous - it is a legitimate background
 * operation every client performs on a 15-minute access-token cycle.
 */
@ConfigurationProperties(prefix = "rate-limit")
data class RateLimitProperties(
    val login: Rule = Rule(limit = 5, window = Duration.ofMinutes(15)),
    val register: Rule = Rule(limit = 5, window = Duration.ofHours(1)),
    val refresh: Rule = Rule(limit = 60, window = Duration.ofMinutes(15)),
) {
    data class Rule(val limit: Int, val window: Duration)
}
