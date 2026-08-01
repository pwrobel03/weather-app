package com.weatherapp.backend.boundary

import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Repository

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

    private companion object {
        // ~100m at Polish latitudes - enough to thin out map-display polygons
        // without visibly distorting powiat shapes.
        const val SIMPLIFY_TOLERANCE_DEGREES = 0.001
    }
}
