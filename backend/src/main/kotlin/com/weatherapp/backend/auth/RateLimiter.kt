package com.weatherapp.backend.auth

import com.github.benmanes.caffeine.cache.Caffeine
import com.github.benmanes.caffeine.cache.Cache
import org.springframework.stereotype.Component
import java.time.Duration
import java.util.concurrent.atomic.AtomicInteger

/**
 * In-memory fixed-window counters, one window per protected endpoint.
 *
 * In-memory is a deliberate fit for the single-instance deployment topology
 * (decision 4 in follow-up.md), not an oversight: with one process there is
 * nothing to share state with. If the backend ever runs more than one
 * instance, these counters become per-instance and the effective limit
 * multiplies by the instance count - that is the point where the same Redis
 * that would carry WebSocket pub/sub has to carry this too.
 */
@Component
class RateLimiter(properties: RateLimitProperties) {

    private val login = Window(properties.login)
    private val register = Window(properties.register)
    private val refresh = Window(properties.refresh)
    private val anonymous = Window(properties.anonymous)

    /** Returns the window guarding this request, or null when the path is unlimited. */
    fun windowFor(method: String, path: String): Window? {
        if (!method.equals("POST", ignoreCase = true)) return null
        return when (path) {
            "/api/auth/login" -> login
            "/api/auth/register" -> register
            "/api/auth/refresh" -> refresh
            "/api/auth/anonymous" -> anonymous
            else -> null
        }
    }

    /** Drops all counters. Test-only seam so one test's attempts don't leak into the next. */
    fun reset() {
        login.reset()
        register.reset()
        refresh.reset()
        anonymous.reset()
    }

    class Window(private val rule: RateLimitProperties.Rule) {

        private val counters: Cache<String, AtomicInteger> = Caffeine.newBuilder()
            .expireAfterWrite(rule.window)
            // Bounded so a flood of distinct source addresses cannot grow this
            // without limit - eviction under attack only ever forgives, never
            // blocks a legitimate caller.
            .maximumSize(100_000)
            .build()

        val retryAfterSeconds: Long = rule.window.seconds

        /** Records an attempt. Returns false once the caller is over budget for the window. */
        fun tryConsume(key: String): Boolean =
            counters.get(key) { AtomicInteger(0) }.incrementAndGet() <= rule.limit

        fun reset() = counters.invalidateAll()
    }
}
