package com.weatherapp.backend.alert

import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Repository

@Repository
class AlertDeliveryRepository(private val jdbcTemplate: JdbcTemplate) {

    /**
     * Claims the right to notify this user about this alert.
     *
     * Returns true exactly once per (alert, user), enforced by the unique
     * constraint rather than by a read-then-write check - two delivery
     * channels racing (a WebSocket fan-out and a push worker, once Faza 5
     * lands) would both pass a check-first test and both notify.
     *
     * Callers must treat false as "someone else already told them" and send
     * nothing.
     */
    fun claimDelivery(alertId: Long, userId: Long): Boolean =
        jdbcTemplate.update(
            """
            INSERT INTO alert_delivery (alert_id, user_id)
            VALUES (?, ?)
            ON CONFLICT (alert_id, user_id) DO NOTHING
            """.trimIndent(),
            alertId,
            userId,
        ) > 0

    fun hasBeenDelivered(alertId: Long, userId: Long): Boolean =
        jdbcTemplate.queryForObject(
            "SELECT EXISTS (SELECT 1 FROM alert_delivery WHERE alert_id = ? AND user_id = ?)",
            Boolean::class.java,
            alertId,
            userId,
        ) == true

    /**
     * Users matched by this alert who have not been notified yet.
     *
     * Reads through alert_location_match, so a user who saves a location while
     * a warning is still in force is picked up on the next pass rather than
     * being missed because the warning was already "handled".
     */
    fun findUsersAwaitingDelivery(alertId: Long): List<Long> =
        jdbcTemplate.query(
            """
            SELECT DISTINCT sl.user_id
            FROM alert_location_match alm
            JOIN saved_location sl ON sl.id = alm.saved_location_id
            WHERE alm.alert_id = ?
              AND NOT EXISTS (
                  SELECT 1 FROM alert_delivery ad
                  WHERE ad.alert_id = alm.alert_id AND ad.user_id = sl.user_id
              )
            ORDER BY sl.user_id
            """.trimIndent(),
            { rs, _ -> rs.getLong("user_id") },
            alertId,
        )
}
