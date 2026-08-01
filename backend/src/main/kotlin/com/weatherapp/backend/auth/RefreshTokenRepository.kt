package com.weatherapp.backend.auth

import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Repository
import java.sql.Timestamp
import java.time.Instant

@Repository
class RefreshTokenRepository(private val jdbcTemplate: JdbcTemplate) {

    fun store(userId: Long, tokenHash: String, expiresAt: Instant) {
        jdbcTemplate.update(
            "INSERT INTO refresh_token (user_id, token_hash, expires_at) VALUES (?, ?, ?)",
            userId,
            tokenHash,
            Timestamp.from(expiresAt),
        )
    }

    fun isActive(tokenHash: String): Boolean =
        jdbcTemplate.queryForObject(
            """
            SELECT EXISTS (
                SELECT 1 FROM refresh_token
                WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > now()
            )
            """.trimIndent(),
            Boolean::class.java,
            tokenHash,
        ) == true

    fun revoke(tokenHash: String) {
        jdbcTemplate.update(
            "UPDATE refresh_token SET revoked_at = now() WHERE token_hash = ? AND revoked_at IS NULL",
            tokenHash,
        )
    }
}
