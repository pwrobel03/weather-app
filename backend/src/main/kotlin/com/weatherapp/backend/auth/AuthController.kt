package com.weatherapp.backend.auth

import com.weatherapp.backend.user.AlreadyRegisteredException
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
import java.security.Principal

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

    @Operation(
        summary = "Register an account",
        description = "Creates a user and returns an access/refresh token pair. Sent with an anonymous session's " +
            "access token, it registers that user instead of creating a second one, so places saved and push " +
            "tokens registered beforehand carry over untouched. Sent with an already-registered session, it is a " +
            "conflict.",
    )
    @PostMapping("/api/auth/register")
    fun register(@Valid @RequestBody request: RegisterRequest, principal: Principal?): AuthResponse {
        // Nullable, and it has to be: this endpoint is public, so a caller with
        // no session at all is the ordinary first-time case on the web.
        val tokens = authService.register(
            request.email,
            request.password,
            request.displayName,
            principal?.name?.toLong(),
        )
        return AuthResponse(tokens.accessToken, tokens.refreshToken)
    }

    @Operation(
        summary = "Start an anonymous session",
        description = "Creates a credential-less user for a device and returns an access/refresh token pair. " +
            "Registering later attaches an email and password to this same user, so anything saved " +
            "beforehand stays where it is.",
    )
    @PostMapping("/api/auth/anonymous")
    fun anonymous(): AuthResponse {
        val tokens = authService.registerAnonymous()
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

    @ExceptionHandler(EmailAlreadyRegisteredException::class, AlreadyRegisteredException::class)
    @ResponseStatus(HttpStatus.CONFLICT)
    fun handleConflict(ex: RuntimeException): Map<String, String?> = mapOf("error" to ex.message)

    @ExceptionHandler(InvalidCredentialsException::class, InvalidRefreshTokenException::class)
    @ResponseStatus(HttpStatus.UNAUTHORIZED)
    fun handleUnauthorized(ex: RuntimeException): Map<String, String?> = mapOf("error" to ex.message)
}
