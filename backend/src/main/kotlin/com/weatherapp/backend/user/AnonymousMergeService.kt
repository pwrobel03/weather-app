package com.weatherapp.backend.user

import org.slf4j.LoggerFactory
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/**
 * Folds a device's anonymous user into the account it just logged in to.
 *
 * Registration needs none of this - it attaches credentials to the row that
 * already holds the data. Logging in is the one case where two users exist and
 * one has to give way: the device saved places before signing in, and the
 * account has its own from another device.
 *
 * The result is the union. Nothing is asked of the user and nothing is dropped
 * silently, which is the whole point - a device that quietly forgot the places
 * saved on it is the failure people do not think to check for until the warning
 * they needed never arrived.
 *
 * The reverse direction needs no code: once the session belongs to the account,
 * the client's saved list *is* the account's list, which now contains both
 * sets. Pulling the account's places "down" to the device is just the next
 * fetch.
 */
@Service
class AnonymousMergeService(private val jdbcTemplate: JdbcTemplate) {

    private val log = LoggerFactory.getLogger(javaClass)

    /**
     * Moves everything the anonymous user owns onto [accountId], then deletes
     * it. Does nothing unless [anonymousId] really is a credential-less user -
     * a mistaken call must never dissolve a real account.
     */
    @Transactional
    fun absorb(anonymousId: Long, accountId: Long) {
        if (anonymousId == accountId) return

        val isAnonymous = jdbcTemplate.queryForObject(
            "SELECT EXISTS (SELECT 1 FROM users WHERE id = ? AND email IS NULL)",
            Boolean::class.java,
            anonymousId,
        ) == true
        if (!isAnonymous) return

        // Places the account already has win, so the move is a union rather
        // than a duplicate. `UNIQUE (user_id, latitude, longitude)` is the
        // deduplication rule, which is why it is expressed as a WHERE NOT
        // EXISTS on those columns and not on the name: two people spell a place
        // differently, but they cannot disagree about where it is.
        val moved = jdbcTemplate.update(
            """
            UPDATE saved_location AS anon
            SET user_id = ?,
                -- Appended after whatever the account already had, keeping
                -- both lists' internal order. Interleaving them by raw
                -- position would scramble an order the user chose on either
                -- device.
                position = anon.position
                    + (SELECT coalesce(max(position), -1) + 1 FROM saved_location WHERE user_id = ?)
            WHERE anon.user_id = ?
              AND NOT EXISTS (
                  SELECT 1 FROM saved_location AS mine
                  WHERE mine.user_id = ?
                    AND mine.latitude = anon.latitude
                    AND mine.longitude = anon.longitude
              )
            """.trimIndent(),
            accountId,
            accountId,
            anonymousId,
            accountId,
        )

        // The device's push token has to follow, or warnings stop arriving on
        // the phone that was just signed in - the one outcome nobody would
        // connect back to having logged in.
        jdbcTemplate.update(
            """
            DELETE FROM user_push_token AS mine
            USING user_push_token AS anon
            WHERE mine.user_id = ? AND anon.user_id = ? AND mine.token = anon.token
            """.trimIndent(),
            accountId,
            anonymousId,
        )
        jdbcTemplate.update("UPDATE user_push_token SET user_id = ? WHERE user_id = ?", accountId, anonymousId)

        // Whatever is left - duplicate places, spent refresh tokens - goes with
        // the row. The device is on the account's session now, so nothing can
        // reach this user again anyway.
        jdbcTemplate.update("DELETE FROM users WHERE id = ?", anonymousId)

        log.info("Merged anonymous user {} into account {}, moving {} saved locations", anonymousId, accountId, moved)
    }
}
