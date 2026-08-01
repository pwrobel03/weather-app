package com.weatherapp.backend.auth

import com.weatherapp.backend.user.EmailAlreadyRegisteredException
import com.weatherapp.backend.user.InvalidCredentialsException
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.tags.Tag
import jakarta.validation.Valid
import jakarta.validation.constraints.Email
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController

data class RegisterRequest(
    @field:Email
    @field:NotBlank
    val email: String,
    // BCrypt silently truncates input beyond 72 bytes - capped here so that
    // never happens invisibly.
    @field:Size(min = 8, max = 72)
    val password: String,
    val displayName: String? = null,
)

data class LoginRequest(
    @field:Email
    @field:NotBlank
    val email: String,
    @field:NotBlank
    val password: String,
)

data class RefreshRequest(@field:NotBlank val refreshToken: String)

data class AuthResponse(val accessToken: String, val refreshToken: String)

@RestController
@Tag(name = "Auth", description = "Registration, login, and token refresh")
class AuthController(private val authService: AuthService) {

    @Operation(summary = "Register a new account", description = "Creates a user and returns an access/refresh token pair.")
    @PostMapping("/api/auth/register")
    fun register(@Valid @RequestBody request: RegisterRequest): AuthResponse {
        val tokens = authService.register(request.email, request.password, request.displayName)
        return AuthResponse(tokens.accessToken, tokens.refreshToken)
    }

    @Operation(summary = "Log in", description = "Exchanges email/password for an access/refresh token pair.")
    @PostMapping("/api/auth/login")
    fun login(@Valid @RequestBody request: LoginRequest): AuthResponse {
        val tokens = authService.login(request.email, request.password)
        return AuthResponse(tokens.accessToken, tokens.refreshToken)
    }

    @Operation(
        summary = "Refresh an access token",
        description = "Exchanges a refresh token for a new token pair. The presented refresh token is revoked (rotation) - reusing it fails.",
    )
    @PostMapping("/api/auth/refresh")
    fun refresh(@Valid @RequestBody request: RefreshRequest): AuthResponse {
        val tokens = authService.refresh(request.refreshToken)
        return AuthResponse(tokens.accessToken, tokens.refreshToken)
    }

    @ExceptionHandler(EmailAlreadyRegisteredException::class)
    @ResponseStatus(HttpStatus.CONFLICT)
    fun handleEmailTaken(ex: EmailAlreadyRegisteredException): Map<String, String?> = mapOf("error" to ex.message)

    @ExceptionHandler(InvalidCredentialsException::class, InvalidRefreshTokenException::class)
    @ResponseStatus(HttpStatus.UNAUTHORIZED)
    fun handleUnauthorized(ex: RuntimeException): Map<String, String?> = mapOf("error" to ex.message)
}
