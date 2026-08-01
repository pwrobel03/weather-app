package com.weatherapp.backend.forecast

import org.springframework.boot.web.servlet.FilterRegistrationBean
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.web.filter.ShallowEtagHeaderFilter

@Configuration
class ForecastCachingConfig {

    /**
     * Weak ETag computed from the response body, so a client polling with an
     * unchanged forecast gets a 304 instead of re-downloading the same JSON.
     */
    @Bean
    fun forecastEtagFilter(): FilterRegistrationBean<ShallowEtagHeaderFilter> =
        FilterRegistrationBean(ShallowEtagHeaderFilter()).apply {
            addUrlPatterns("/api/forecast/*")
        }
}
