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
    /**
     * Anonymous sessions write a `users` row with no credentials attached, so
     * an unlimited endpoint is a table-growth primitive for anyone with a
     * script.
     *
     * Far looser than the credential endpoints, because the thing being
     * protected is different and the key is the wrong shape for the job. A
     * device asks for one of these once per install, but the counter is per
     * address, and a household, an office or a carrier's NAT are all one
     * address - a handful per hour would lock out real first launches, which
     * is a worse failure than the rows it saves. Abuse is bounded anyway: an
     * unreachable anonymous user is collected once its tokens lapse.
     */
    val anonymous: Rule = Rule(limit = 60, window = Duration.ofHours(1)),
) {
    data class Rule(val limit: Int, val window: Duration)
}
