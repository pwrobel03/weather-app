package com.weatherapp.backend.savedlocation

import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Repository
import java.sql.ResultSet

@Repository
class SavedLocationRepository(private val jdbcTemplate: JdbcTemplate) {

    fun findAllByUserId(userId: Long): List<SavedLocation> =
        jdbcTemplate.query(
            """
            SELECT id, user_id, name, latitude, longitude, teryt_code, created_at
            FROM saved_location
            WHERE user_id = ?
            ORDER BY created_at
            """.trimIndent(),
            { rs, _ -> rs.toSavedLocation() },
            userId,
        )

    fun findByIdAndUserId(id: Long, userId: Long): SavedLocation? =
        jdbcTemplate.query(
            """
            SELECT id, user_id, name, latitude, longitude, teryt_code, created_at
            FROM saved_location
            WHERE id = ? AND user_id = ?
            """.trimIndent(),
            { rs, _ -> rs.toSavedLocation() },
            id,
            userId,
        ).firstOrNull()

    fun create(userId: Long, name: String, latitude: Double, longitude: Double, terytCode: String?): SavedLocation {
        val id = jdbcTemplate.queryForObject(
            """
            INSERT INTO saved_location (user_id, name, latitude, longitude, teryt_code)
            VALUES (?, ?, ?, ?, ?)
            RETURNING id
            """.trimIndent(),
            Long::class.java,
            userId,
            name,
            latitude,
            longitude,
            terytCode,
        )!!
        return findByIdAndUserId(id, userId)!!
    }

    /** Returns true if a row was actually deleted (i.e. it existed and was owned by this user). */
    fun deleteByIdAndUserId(id: Long, userId: Long): Boolean =
        jdbcTemplate.update("DELETE FROM saved_location WHERE id = ? AND user_id = ?", id, userId) > 0

    private fun ResultSet.toSavedLocation() = SavedLocation(
        id = getLong("id"),
        userId = getLong("user_id"),
        name = getString("name"),
        latitude = getDouble("latitude"),
        longitude = getDouble("longitude"),
        terytCode = getString("teryt_code"),
        createdAt = getTimestamp("created_at").toInstant(),
    )
}
