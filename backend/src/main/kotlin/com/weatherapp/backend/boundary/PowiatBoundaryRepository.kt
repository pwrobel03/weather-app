package com.weatherapp.backend.boundary

import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Repository
import java.time.Instant

@Repository
class PowiatBoundaryRepository(private val jdbcTemplate: JdbcTemplate) {

    /**
     * Point-in-polygon lookup. Argument order matters: PostGIS points are
     * (x, y) i.e. (longitude, latitude), not (latitude, longitude).
     */
    fun findContainingPoint(latitude: Double, longitude: Double): PowiatBoundary? =
        jdbcTemplate.query(
            """
            SELECT teryt_code, name, voivodeship
            FROM powiat_boundary
            WHERE ST_Contains(boundary::geometry, ST_SetSRID(ST_MakePoint(?, ?), 4326))
            LIMIT 1
            """.trimIndent(),
            { rs, _ ->
                PowiatBoundary(
                    terytCode = rs.getString("teryt_code"),
                    name = rs.getString("name"),
                    voivodeship = rs.getString("voivodeship"),
                )
            },
            longitude,
            latitude,
        ).firstOrNull()

    fun findSimplifiedGeoJson(terytCode: String): PowiatGeoJsonFeature? =
        jdbcTemplate.query(
            """
            SELECT teryt_code, name, voivodeship,
                   ST_AsGeoJSON(ST_Multi(ST_SimplifyPreserveTopology(boundary::geometry, ?))) AS geometry
            FROM powiat_boundary
            WHERE teryt_code = ?
            """.trimIndent(),
            { rs, _ ->
                PowiatGeoJsonFeature(
                    properties = PowiatGeoJsonFeature.Properties(
                        terytCode = rs.getString("teryt_code"),
                        name = rs.getString("name"),
                        voivodeship = rs.getString("voivodeship"),
                    ),
                    geometry = rs.getString("geometry"),
                )
            },
            SIMPLIFY_TOLERANCE_DEGREES,
            terytCode,
        ).firstOrNull()

    /**
     * The same simplified geometry as [findSimplifiedGeoJson], for many codes
     * at once.
     *
     * One statement rather than a loop of them: a single IMGW warning can name
     * over a hundred powiats, and issuing a query per code turns one map render
     * into a hundred round trips against geometry that is identical every time.
     *
     * Codes are bound as parameters, never interpolated - they arrive from a
     * query string.
     */
    fun findSimplifiedGeoJson(terytCodes: Collection<String>): List<PowiatGeoJsonFeature> {
        if (terytCodes.isEmpty()) return emptyList()

        val placeholders = terytCodes.joinToString(",") { "?" }
        return jdbcTemplate.query(
            """
            SELECT teryt_code, name, voivodeship,
                   ST_AsGeoJSON(ST_Multi(ST_SimplifyPreserveTopology(boundary::geometry, ?))) AS geometry
            FROM powiat_boundary
            WHERE teryt_code IN ($placeholders)
            ORDER BY teryt_code
            """.trimIndent(),
            { rs, _ ->
                PowiatGeoJsonFeature(
                    properties = PowiatGeoJsonFeature.Properties(
                        terytCode = rs.getString("teryt_code"),
                        name = rs.getString("name"),
                        voivodeship = rs.getString("voivodeship"),
                    ),
                    geometry = rs.getString("geometry"),
                )
            },
            SIMPLIFY_TOLERANCE_DEGREES,
            *terytCodes.toTypedArray(),
        )
    }

    /**
     * When the boundary dataset was last written, used as its version.
     *
     * Derived from the data rather than from a clock or a deploy marker: the
     * import truncates and reinserts (commit 24), so this changes exactly when
     * the geometry changes and at no other time. A clock-based version would
     * expire correct caches nightly; a deploy-based one would serve stale
     * geometry after an import with no deploy.
     */
    fun datasetVersion(): Instant? =
        jdbcTemplate.queryForObject(
            "SELECT max(created_at) FROM powiat_boundary",
            Instant::class.java,
        )

    private companion object {
        // ~100m at Polish latitudes - enough to thin out map-display polygons
        // without visibly distorting powiat shapes.
        const val SIMPLIFY_TOLERANCE_DEGREES = 0.001
    }
}
