package com.weatherapp.backend.savedlocation

import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Repository
import java.sql.ResultSet

@Repository
class SavedLocationRepository(private val jdbcTemplate: JdbcTemplate) {

    fun findAllByUserId(userId: Long): List<SavedLocation> =
        jdbcTemplate.query(
            """
            SELECT id, user_id, name, latitude, longitude, teryt_code, position, created_at
            FROM saved_location
            WHERE user_id = ?
            ORDER BY position, created_at
            """.trimIndent(),
            { rs, _ -> rs.toSavedLocation() },
            userId,
        )

    fun findByIdAndUserId(id: Long, userId: Long): SavedLocation? =
        jdbcTemplate.query(
            """
            SELECT id, user_id, name, latitude, longitude, teryt_code, position, created_at
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
            INSERT INTO saved_location (user_id, name, latitude, longitude, teryt_code, position)
            VALUES (
                ?, ?, ?, ?, ?,
                -- Appended, not prepended: a new place is the least likely to
                -- be the one being watched, and a list that reshuffles itself
                -- on every save is one nobody bothers arranging.
                (SELECT coalesce(max(position), -1) + 1 FROM saved_location WHERE user_id = ?)
            )
            RETURNING id
            """.trimIndent(),
            Long::class.java,
            userId,
            name,
            latitude,
            longitude,
            terytCode,
            userId,
        )!!
        return findByIdAndUserId(id, userId)!!
    }

    /** The ids this user has saved, in their current order. */
    fun idsInOrder(userId: Long): List<Long> =
        jdbcTemplate.queryForList(
            "SELECT id FROM saved_location WHERE user_id = ? ORDER BY position, created_at",
            Long::class.java,
            userId,
        ).filterNotNull()

    /**
     * Writes [orderedIds] as positions 0..n-1.
     *
     * Scoped by user_id in the statement itself, not only by the check above
     * it: an id belonging to somebody else must be a no-op even if validation
     * were ever bypassed.
     */
    fun applyOrder(userId: Long, orderedIds: List<Long>) {
        jdbcTemplate.batchUpdate(
            "UPDATE saved_location SET position = ? WHERE id = ? AND user_id = ?",
            orderedIds.mapIndexed { index, id -> arrayOf<Any>(index, id, userId) },
        )
    }

    /** Returns true if a row was actually deleted (i.e. it existed and was owned by this user). */
    fun deleteByIdAndUserId(id: Long, userId: Long): Boolean =
        jdbcTemplate.update("DELETE FROM saved_location WHERE id = ? AND user_id = ?", id, userId) > 0

    /**
     * Recomputes teryt_code for every saved location against the current
     * boundary table, in one statement.
     *
     * `teryt_code` is a denormalisation: it is resolved once at save time and
     * is the sole source of truth for alert matching afterwards. Replacing the
     * boundaries underneath it therefore turns a stale code into a silently
     * undelivered warning - this is what repairs that.
     *
     * `IS DISTINCT FROM` (not `<>`) so the NULL cases compare correctly, and
     * so the returned count is rows actually changed rather than rows visited.
     * A location outside every known boundary resolves to NULL, which is an
     * expected outcome, not an error.
     */
    fun reresolveAllTerytCodes(): Int =
        jdbcTemplate.update(
            """
            UPDATE saved_location sl
            SET teryt_code = resolved.teryt_code
            FROM (
                SELECT sl2.id,
                       (
                           SELECT pb.teryt_code
                           FROM powiat_boundary pb
                           WHERE ST_Contains(
                               pb.boundary::geometry,
                               ST_SetSRID(ST_MakePoint(sl2.longitude, sl2.latitude), 4326)
                           )
                           LIMIT 1
                       ) AS teryt_code
                FROM saved_location sl2
            ) AS resolved
            WHERE sl.id = resolved.id
              AND sl.teryt_code IS DISTINCT FROM resolved.teryt_code
            """.trimIndent(),
        )

    private fun ResultSet.toSavedLocation() = SavedLocation(
        id = getLong("id"),
        userId = getLong("user_id"),
        name = getString("name"),
        latitude = getDouble("latitude"),
        longitude = getDouble("longitude"),
        terytCode = getString("teryt_code"),
        position = getInt("position"),
        createdAt = getTimestamp("created_at").toInstant(),
    )
}
