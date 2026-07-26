package com.weatherapp.backend.auth

import com.weatherapp.backend.user.UserRole
import io.jsonwebtoken.Claims
import io.jsonwebtoken.Jwts
import io.jsonwebtoken.security.Keys
import org.springframework.stereotype.Component
import java.time.Duration
import java.time.Instant
import java.util.Date
import java.util.UUID
import javax.crypto.SecretKey

@Component
class JwtService(private val properties: JwtProperties) {

    private val key: SecretKey = Keys.hmacShaKeyFor(properties.secret.toByteArray())

    /**
     * The role rides in the access token so authorization needs no database
     * round trip per request. The cost is staleness bounded by the access
     * token TTL (15 min): a demotion takes effect on the next refresh, not
     * instantly. Acceptable because promotion to ADMIN is a deliberate,
     * rare, manual act - not something users toggle.
     */
    fun generateAccessToken(userId: Long, role: UserRole): String =
        generateToken(userId, properties.accessTokenTtl, TOKEN_TYPE_ACCESS, role)

    fun generateRefreshToken(userId: Long): String =
        generateToken(userId, properties.refreshTokenTtl, TOKEN_TYPE_REFRESH, role = null)

    fun parse(token: String): Claims = Jwts.parser().verifyWith(key).build().parseSignedClaims(token).payload

    private fun generateToken(userId: Long, ttl: Duration, tokenType: String, role: UserRole?): String {
        val now = Instant.now()
        return Jwts.builder()
            .id(UUID.randomUUID().toString())
            .subject(userId.toString())
            .claim(CLAIM_TOKEN_TYPE, tokenType)
            .apply { role?.let { claim(CLAIM_ROLE, it.name) } }
            .issuedAt(Date.from(now))
            .expiration(Date.from(now.plus(ttl)))
            .signWith(key)
            .compact()
    }

    companion object {
        const val CLAIM_TOKEN_TYPE = "type"
        const val CLAIM_ROLE = "role"
        const val TOKEN_TYPE_ACCESS = "access"
        const val TOKEN_TYPE_REFRESH = "refresh"
    }
}
