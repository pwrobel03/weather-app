package com.weatherapp.backend.user

import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Repository
import java.sql.ResultSet

private const val SELECT_COLUMNS =
    "id, email, password_hash, display_name, temperature_unit, wind_speed_unit, precipitation_unit, created_at"

@Repository
class UserRepository(private val jdbcTemplate: JdbcTemplate) {

    fun findByEmail(email: String): User? =
        jdbcTemplate.query(
            "SELECT $SELECT_COLUMNS FROM users WHERE email = ?",
            { rs, _ -> rs.toUser() },
            email,
        ).firstOrNull()

    fun findById(id: Long): User? =
        jdbcTemplate.query(
            "SELECT $SELECT_COLUMNS FROM users WHERE id = ?",
            { rs, _ -> rs.toUser() },
            id,
        ).firstOrNull()

    fun create(email: String, passwordHash: String, displayName: String?): User {
        val id = jdbcTemplate.queryForObject(
            "INSERT INTO users (email, password_hash, display_name) VALUES (?, ?, ?) RETURNING id",
            Long::class.java,
            email,
            passwordHash,
            displayName,
        )!!
        return findById(id)!!
    }

    fun updatePreferences(
        userId: Long,
        temperatureUnit: TemperatureUnit,
        windSpeedUnit: WindSpeedUnit,
        precipitationUnit: PrecipitationUnit,
    ) {
        jdbcTemplate.update(
            "UPDATE users SET temperature_unit = ?, wind_speed_unit = ?, precipitation_unit = ? WHERE id = ?",
            temperatureUnit.name,
            windSpeedUnit.name,
            precipitationUnit.name,
            userId,
        )
    }

    private fun ResultSet.toUser() = User(
        id = getLong("id"),
        email = getString("email"),
        passwordHash = getString("password_hash"),
        displayName = getString("display_name"),
        temperatureUnit = TemperatureUnit.valueOf(getString("temperature_unit")),
        windSpeedUnit = WindSpeedUnit.valueOf(getString("wind_speed_unit")),
        precipitationUnit = PrecipitationUnit.valueOf(getString("precipitation_unit")),
        createdAt = getTimestamp("created_at").toInstant(),
    )
}
