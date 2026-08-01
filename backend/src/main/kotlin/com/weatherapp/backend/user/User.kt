package com.weatherapp.backend.user

import java.time.Instant

/**
 * A user, registered or not.
 *
 * Email and password hash are absent together on a device that has not
 * registered - see V13. Everything else about such a user is ordinary, which is
 * the point: saved locations, push tokens and warning matching all key off the
 * id and never ask how the row came to exist.
 */
data class User(
    val id: Long,
    val email: String?,
    val passwordHash: String?,
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
