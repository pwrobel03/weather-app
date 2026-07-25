package com.weatherapp.backend.auth

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

    fun generateAccessToken(userId: Long): String =
        generateToken(userId, properties.accessTokenTtl, TOKEN_TYPE_ACCESS)

    fun generateRefreshToken(userId: Long): String =
        generateToken(userId, properties.refreshTokenTtl, TOKEN_TYPE_REFRESH)

    fun parse(token: String): Claims = Jwts.parser().verifyWith(key).build().parseSignedClaims(token).payload

    private fun generateToken(userId: Long, ttl: Duration, tokenType: String): String {
        val now = Instant.now()
        return Jwts.builder()
            .id(UUID.randomUUID().toString())
            .subject(userId.toString())
            .claim(CLAIM_TOKEN_TYPE, tokenType)
            .issuedAt(Date.from(now))
            .expiration(Date.from(now.plus(ttl)))
            .signWith(key)
            .compact()
    }

    companion object {
        const val CLAIM_TOKEN_TYPE = "type"
        const val TOKEN_TYPE_ACCESS = "access"
        const val TOKEN_TYPE_REFRESH = "refresh"
    }
}
