package com.weatherapp.backend.auth

import com.weatherapp.backend.user.User
import com.weatherapp.backend.user.UserService
import io.jsonwebtoken.JwtException
import org.springframework.stereotype.Service
import java.security.MessageDigest
import java.time.Instant

data class TokenPair(val accessToken: String, val refreshToken: String)

@Service
class AuthService(
    private val userService: UserService,
    private val jwtService: JwtService,
    private val refreshTokenRepository: RefreshTokenRepository,
    private val properties: JwtProperties,
) {

    /**
     * Registers, either as a fresh account or as the caller's own anonymous
     * user when the request carries an anonymous session.
     */
    fun register(email: String, password: String, displayName: String?, currentUserId: Long?): TokenPair {
        val user = if (currentUserId == null) {
            userService.register(email, password, displayName)
        } else {
            userService.promote(currentUserId, email, password, displayName)
        }
        return issueTokens(user)
    }

    /**
     * Issues a session for a brand-new anonymous user.
     *
     * The refresh token is the device's only proof of who it is - there is no
     * email to recover from - so the client has to keep it somewhere durable
     * and private. Rotation still applies, exactly as for a registered user.
     */
    fun registerAnonymous(): TokenPair = issueTokens(userService.createAnonymous())

    fun login(email: String, password: String): TokenPair {
        val user = userService.authenticate(email, password)
        return issueTokens(user)
    }

    /**
     * Rotates refresh tokens: the presented token is revoked as soon as it's
     * used, so replaying an already-used (or never-issued) refresh token
     * always fails - a simple, effective signal that a token may have leaked.
     */
    fun refresh(refreshToken: String): TokenPair {
        val claims = try {
            jwtService.parse(refreshToken)
        } catch (ex: JwtException) {
            throw InvalidRefreshTokenException()
        }
        if (claims[JwtService.CLAIM_TOKEN_TYPE] != JwtService.TOKEN_TYPE_REFRESH) {
            throw InvalidRefreshTokenException()
        }

        val tokenHash = hash(refreshToken)
        if (!refreshTokenRepository.isActive(tokenHash)) {
            throw InvalidRefreshTokenException()
        }
        refreshTokenRepository.revoke(tokenHash)

        val userId = claims.subject.toLong()
        val user = userService.getById(userId) ?: throw InvalidRefreshTokenException()
        return issueTokens(user)
    }

    private fun issueTokens(user: User): TokenPair {
        val accessToken = jwtService.generateAccessToken(user.id, user.role)
        val refreshToken = jwtService.generateRefreshToken(user.id)
        refreshTokenRepository.store(user.id, hash(refreshToken), Instant.now().plus(properties.refreshTokenTtl))
        return TokenPair(accessToken, refreshToken)
    }

    private fun hash(token: String): String =
        MessageDigest.getInstance("SHA-256").digest(token.toByteArray()).joinToString("") { "%02x".format(it) }
}
