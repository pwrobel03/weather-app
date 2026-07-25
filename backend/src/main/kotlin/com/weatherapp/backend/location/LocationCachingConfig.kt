package com.weatherapp.backend.location

import org.springframework.boot.web.servlet.FilterRegistrationBean
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.web.filter.ShallowEtagHeaderFilter

@Configuration
class LocationCachingConfig {

    /**
     * Weak ETag computed from the response body for location search results,
     * allowing clients to receive 304 Not Modified when search results remain unchanged.
     */
    @Bean
    fun locationEtagFilter(): FilterRegistrationBean<ShallowEtagHeaderFilter> =
        FilterRegistrationBean(ShallowEtagHeaderFilter()).apply {
            addUrlPatterns("/api/locations/*")
        }
}
