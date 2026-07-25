package com.weatherapp.backend.savedlocation

import java.time.Instant

data class SavedLocation(
    val id: Long,
    val userId: Long,
    val name: String,
    val latitude: Double,
    val longitude: Double,
    val terytCode: String?,
    val createdAt: Instant,
)
