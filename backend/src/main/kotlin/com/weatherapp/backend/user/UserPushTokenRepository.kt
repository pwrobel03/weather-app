package com.weatherapp.backend.user

import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Repository

/** One registered device: where to send, in what language, on whose clock. */
data class PushDevice(val token: String, val locale: String, val timeZone: String)

@Repository
class UserPushTokenRepository(private val jdbcTemplate: JdbcTemplate) {

    fun upsert(userId: Long, token: String, locale: String, timeZone: String) {
        jdbcTemplate.update(
            """
            INSERT INTO user_push_token (user_id, token, locale, time_zone, created_at, updated_at)
            VALUES (?, ?, ?, ?, now(), now())
            ON CONFLICT (token) DO UPDATE
            SET user_id = EXCLUDED.user_id,
                locale = EXCLUDED.locale,
                time_zone = EXCLUDED.time_zone,
                updated_at = now()
            """.trimIndent(),
            userId,
            token,
            locale,
            timeZone,
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

    /**
     * Every registered device of one user, with what it needs to be addressed.
     *
     * Returned per device rather than grouped, because quiet hours are decided
     * per device: two phones on one account can be in different zones, and one
     * of them being asleep says nothing about the other.
     */
    fun findDevicesByUserId(userId: Long): List<PushDevice> =
        jdbcTemplate.query(
            "SELECT token, locale, time_zone FROM user_push_token WHERE user_id = ?",
            { rs, _ ->
                PushDevice(
                    token = rs.getString("token"),
                    locale = rs.getString("locale"),
                    timeZone = rs.getString("time_zone"),
                )
            },
            userId,
        )
}
