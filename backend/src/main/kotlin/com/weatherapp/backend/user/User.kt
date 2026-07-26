package com.weatherapp.backend.user

import java.time.Instant

data class User(
    val id: Long,
    val email: String,
    val passwordHash: String,
    val displayName: String?,
    val role: UserRole,
    val temperatureUnit: TemperatureUnit,
    val windSpeedUnit: WindSpeedUnit,
    val precipitationUnit: PrecipitationUnit,
    val createdAt: Instant,
)

enum class UserRole { USER, ADMIN }

enum class TemperatureUnit { CELSIUS, FAHRENHEIT }

enum class WindSpeedUnit { KMH, MPH }

enum class PrecipitationUnit { MM, IN }
