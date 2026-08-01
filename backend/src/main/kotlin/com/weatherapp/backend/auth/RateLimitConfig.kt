package com.weatherapp.backend.auth

import org.springframework.boot.web.servlet.FilterRegistrationBean
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.core.Ordered

@Configuration
class RateLimitConfig {

    /**
     * Registered explicitly rather than as a `@Component` so the ordering is
     * stated, not inherited: this has to run ahead of the security filter
     * chain for the rejection to happen before any password work.
     */
    @Bean
    fun rateLimitFilterRegistration(rateLimiter: RateLimiter): FilterRegistrationBean<RateLimitFilter> =
        FilterRegistrationBean(RateLimitFilter(rateLimiter)).apply {
            addUrlPatterns("/api/auth/*")
            order = Ordered.HIGHEST_PRECEDENCE
        }
}
