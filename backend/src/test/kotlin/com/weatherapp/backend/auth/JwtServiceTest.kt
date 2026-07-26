package com.weatherapp.backend.auth

import com.weatherapp.backend.user.UserRole
import org.junit.jupiter.api.Test
import java.time.Duration
import kotlin.test.assertEquals
import kotlin.test.assertNull

class JwtServiceTest {

    private val jwtService = JwtService(
        JwtProperties(
            secret = "test-secret-key-long-enough-for-hmac-sha256-signing",
            accessTokenTtl = Duration.ofMinutes(15),
            refreshTokenTtl = Duration.ofDays(30),
        ),
    )

    @Test
    fun `access token carries the user role`() {
        val claims = jwtService.parse(jwtService.generateAccessToken(7L, UserRole.ADMIN))

        assertEquals("7", claims.subject)
        assertEquals(JwtService.TOKEN_TYPE_ACCESS, claims[JwtService.CLAIM_TOKEN_TYPE])
        assertEquals("ADMIN", claims[JwtService.CLAIM_ROLE])
    }

    @Test
    fun `plain users get their role stamped too`() {
        val claims = jwtService.parse(jwtService.generateAccessToken(7L, UserRole.USER))

        assertEquals("USER", claims[JwtService.CLAIM_ROLE])
    }

    /**
     * A refresh token is only ever exchanged for a fresh access token, and the
     * role is re-read from the database at that point. Carrying a role here
     * would just be a second, staler copy with a 30-day lifetime.
     */
    @Test
    fun `refresh token carries no role`() {
        val claims = jwtService.parse(jwtService.generateRefreshToken(7L))

        assertEquals(JwtService.TOKEN_TYPE_REFRESH, claims[JwtService.CLAIM_TOKEN_TYPE])
        assertNull(claims[JwtService.CLAIM_ROLE])
    }
}
