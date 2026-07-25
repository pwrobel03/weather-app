package com.weatherapp.backend.user

import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Repository
import java.sql.ResultSet

@Repository
class UserRepository(private val jdbcTemplate: JdbcTemplate) {

    fun findByEmail(email: String): User? =
        jdbcTemplate.query(
            "SELECT id, email, password_hash, display_name, created_at FROM users WHERE email = ?",
            { rs, _ -> rs.toUser() },
            email,
        ).firstOrNull()

    fun findById(id: Long): User? =
        jdbcTemplate.query(
            "SELECT id, email, password_hash, display_name, created_at FROM users WHERE id = ?",
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

    private fun ResultSet.toUser() = User(
        id = getLong("id"),
        email = getString("email"),
        passwordHash = getString("password_hash"),
        displayName = getString("display_name"),
        createdAt = getTimestamp("created_at").toInstant(),
    )
}
