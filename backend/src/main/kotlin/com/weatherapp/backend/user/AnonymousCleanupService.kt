package com.weatherapp.backend.user

import org.slf4j.LoggerFactory
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Service

/**
 * Deletes anonymous users that have become unreachable.
 *
 * "Unreachable" is not a retention policy invented here - it is a fact the
 * schema already decides. An anonymous user has no email and no password, so a
 * refresh token is the only thing that can ever authenticate as it. Once every
 * one of its refresh tokens is expired or revoked, no device on earth can
 * present a credential for that row again: the places saved under it are
 * unreadable by anyone, forever.
 *
 * That makes this collection of provably dead rows rather than a judgement
 * about how long someone may stay away. A device that opens the app inside the
 * refresh window rotates its token and is never a candidate; one that does not
 * has already lost the data regardless of whether this job runs.
 *
 * Registered users are untouched whatever their tokens look like - they can
 * always log in again.
 */
@Service
class AnonymousCleanupService(private val jdbcTemplate: JdbcTemplate) {

    private val log = LoggerFactory.getLogger(javaClass)

    fun sweep(): Int {
        val deleted = jdbcTemplate.update(
            """
            DELETE FROM users
            WHERE email IS NULL
              AND NOT EXISTS (
                  SELECT 1 FROM refresh_token
                  WHERE refresh_token.user_id = users.id
                    AND revoked_at IS NULL
                    AND expires_at > now()
              )
            """.trimIndent(),
        )

        // Saved locations, push tokens and refresh tokens all cascade from
        // users, so this one statement is the whole deletion.
        if (deleted > 0) log.info("Collected {} unreachable anonymous users", deleted)
        return deleted
    }
}
