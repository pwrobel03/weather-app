package com.weatherapp.backend.openmeteo

import org.springframework.boot.context.properties.ConfigurationProperties

@ConfigurationProperties(prefix = "open-meteo")
data class OpenMeteoProperties(val baseUrl: String)
