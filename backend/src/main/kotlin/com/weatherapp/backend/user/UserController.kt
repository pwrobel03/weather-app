package com.weatherapp.backend.user

import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.security.SecurityRequirement
import io.swagger.v3.oas.annotations.tags.Tag
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import java.security.Principal

data class UserResponse(
    val id: Long,
    val email: String,
    val displayName: String?,
    val temperatureUnit: TemperatureUnit,
    val windSpeedUnit: WindSpeedUnit,
    val precipitationUnit: PrecipitationUnit,
) {
    companion object {
        fun from(user: User) = UserResponse(
            id = user.id,
            email = user.email,
            displayName = user.displayName,
            temperatureUnit = user.temperatureUnit,
            windSpeedUnit = user.windSpeedUnit,
            precipitationUnit = user.precipitationUnit,
        )
    }
}

data class UpdatePreferencesRequest(
    val temperatureUnit: TemperatureUnit? = null,
    val windSpeedUnit: WindSpeedUnit? = null,
    val precipitationUnit: PrecipitationUnit? = null,
)

@RestController
@Tag(name = "User", description = "The authenticated user's own profile and preferences")
@SecurityRequirement(name = "bearerAuth")
class UserController(private val userService: UserService) {

    @Operation(summary = "Get the current user's profile")
    @GetMapping("/api/users/me")
    fun me(principal: Principal): ResponseEntity<UserResponse> {
        val user = userService.getById(principal.userId) ?: return ResponseEntity.status(HttpStatus.NOT_FOUND).build()
        return ResponseEntity.ok(UserResponse.from(user))
    }

    @Operation(
        summary = "Update unit preferences",
        description = "Fields left out (null) keep their current value - this is a partial update.",
    )
    @PatchMapping("/api/users/me/preferences")
    fun updatePreferences(principal: Principal, @RequestBody request: UpdatePreferencesRequest): UserResponse {
        val user = userService.updatePreferences(
            principal.userId,
            request.temperatureUnit,
            request.windSpeedUnit,
            request.precipitationUnit,
        )
        return UserResponse.from(user)
    }

    @ExceptionHandler(UserNotFoundException::class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    fun handleNotFound(ex: UserNotFoundException): Map<String, String?> = mapOf("error" to ex.message)

    private val Principal.userId: Long
        get() = name.toLong()
}
