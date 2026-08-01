package com.weatherapp.backend.realtime

import org.springframework.boot.context.properties.ConfigurationProperties

@ConfigurationProperties(prefix = "expo")
data class ExpoPushProperties(
    val baseUrl: String = "https://exp.host",
)
