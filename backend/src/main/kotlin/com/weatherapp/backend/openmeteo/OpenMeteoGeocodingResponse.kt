package com.weatherapp.backend.openmeteo

import com.fasterxml.jackson.annotation.JsonProperty

data class OpenMeteoGeocodingResponse(
    val results: List<OpenMeteoGeocodingResult>? = null,
)

data class OpenMeteoGeocodingResult(
    val id: Long,
    val name: String,
    val latitude: Double,
    val longitude: Double,
    val elevation: Double? = null,
    val timezone: String? = null,
    @JsonProperty("country_code") val countryCode: String? = null,
    val country: String? = null,
    val admin1: String? = null,
    val admin2: String? = null,
    val admin3: String? = null,
    @JsonProperty("feature_code") val featureCode: String? = null,
)
