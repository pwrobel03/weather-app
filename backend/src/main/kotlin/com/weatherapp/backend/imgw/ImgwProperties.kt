package com.weatherapp.backend.imgw

import org.springframework.boot.context.properties.ConfigurationProperties

@ConfigurationProperties(prefix = "imgw")
data class ImgwProperties(
    val baseUrl: String = "https://danepubliczne.imgw.pl",
)
