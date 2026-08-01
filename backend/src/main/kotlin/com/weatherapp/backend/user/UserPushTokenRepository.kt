package com.weatherapp.backend.user

import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Repository

@Repository
class UserPushTokenRepository(private val jdbcTemplate: JdbcTemplate) {

    fun upsert(userId: Long, token: String) {
        jdbcTemplate.update(
            """
            INSERT INTO user_push_token (user_id, token, created_at, updated_at)
            VALUES (?, ?, now(), now())
            ON CONFLICT (token) DO UPDATE
            SET user_id = EXCLUDED.user_id, updated_at = now()
            """.trimIndent(),
            userId,
            token,
        )
    }

    fun delete(userId: Long, token: String) {
        jdbcTemplate.update(
            "DELETE FROM user_push_token WHERE user_id = ? AND token = ?",
            userId,
            token,
        )
    }

    fun findTokensByUserId(userId: Long): List<String> =
        jdbcTemplate.query(
            "SELECT token FROM user_push_token WHERE user_id = ?",
            { rs, _ -> rs.getString("token") },
            userId,
        )
}
