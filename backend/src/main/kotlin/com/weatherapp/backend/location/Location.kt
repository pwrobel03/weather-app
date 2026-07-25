package com.weatherapp.backend.location

import io.swagger.v3.oas.annotations.media.Schema

@Schema(description = "Location search result with geocoded coordinates and administrative divisions")
data class LocationSearchResult(
    @Schema(description = "Unique external geocoding ID (Open-Meteo)", example = "756135")
    val id: Long,
    @Schema(description = "Location name / city", example = "Warszawa")
    val name: String,
    @Schema(description = "Latitude in decimal degrees", example = "52.22977")
    val latitude: Double,
    @Schema(description = "Longitude in decimal degrees", example = "21.01178")
    val longitude: Double,
    @Schema(description = "Elevation above sea level in meters", example = "113.0")
    val elevation: Double?,
    @Schema(description = "Timezone identifier", example = "Europe/Warsaw")
    val timezone: String?,
    @Schema(description = "Country code (ISO 3166-1 alpha-2)", example = "PL")
    val countryCode: String?,
    @Schema(description = "Country name", example = "Polska")
    val country: String?,
    @Schema(description = "Primary administrative division (e.g. Voivodeship / Province / State)", example = "Województwo Mazowieckie")
    val admin1: String?,
    @Schema(description = "Secondary administrative division (e.g. County / Powiat)", example = "Warszawa")
    val admin2: String?,
)
