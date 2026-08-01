package com.weatherapp.backend.user

import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Repository

@Repository
class UserPushTokenRepository(private val jdbcTemplate: JdbcTemplate) {

    fun upsert(userId: Long, token: String, locale: String) {
        jdbcTemplate.update(
            """
            INSERT INTO user_push_token (user_id, token, locale, created_at, updated_at)
            VALUES (?, ?, ?, now(), now())
            ON CONFLICT (token) DO UPDATE
            SET user_id = EXCLUDED.user_id, locale = EXCLUDED.locale, updated_at = now()
            """.trimIndent(),
            userId,
            token,
            locale,
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

    /**
     * Tokens grouped by the language each device asked for.
     *
     * Grouped rather than returned flat because the dispatcher composes one
     * message per language, not one per device: a user with three phones in
     * the same language should cost one string, not three.
     */
    fun findTokensByUserIdGroupedByLocale(userId: Long): Map<String, List<String>> =
        jdbcTemplate.query(
            "SELECT token, locale FROM user_push_token WHERE user_id = ?",
            { rs, _ -> rs.getString("locale") to rs.getString("token") },
            userId,
        ).groupBy({ it.first }, { it.second })
}
