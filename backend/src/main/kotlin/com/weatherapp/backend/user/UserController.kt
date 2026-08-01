package com.weatherapp.backend.user

import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.security.SecurityRequirement
import io.swagger.v3.oas.annotations.tags.Tag
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import java.security.Principal
import java.time.ZoneId

data class UserResponse(
    val id: Long,
    /** Absent until the device registers. */
    val email: String?,
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

data class RegisterPushTokenRequest(
    val token: String,
    /**
     * The language this device wants its notifications in.
     *
     * Optional so an older client keeps working; absent means Polish, which is
     * what those clients are already receiving.
     */
    val locale: String? = null,
    /**
     * IANA zone this device wants its quiet hours measured in.
     *
     * Optional so an older client keeps working; absent means Europe/Warsaw,
     * which is where every device registered before this field existed is.
     */
    val timeZone: String? = null,
)

@RestController
@Tag(name = "User", description = "The authenticated user's own profile and preferences")
@SecurityRequirement(name = "bearerAuth")
class UserController(
    private val userService: UserService,
    private val userPushTokenRepository: UserPushTokenRepository,
) {

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

    @Operation(
        summary = "Register an Expo push notification token",
        description = "Registers an APNs or FCM push token for delivery when the app is in the background.",
    )
    @PostMapping("/api/users/me/push-tokens")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun registerPushToken(principal: Principal, @RequestBody request: RegisterPushTokenRequest) {
        // Normalised here rather than trusted: this is a two-character column
        // and the value arrives from a client.
        val locale = if (request.locale?.lowercase() == "en") "en" else "pl"
        // Validated rather than trusted: an unknown identifier would make every
        // future quiet-hours check fall through to "notify" - the safe
        // direction, but silently wrong. Rejecting it at the door keeps the
        // column meaning what it says.
        val timeZone = request.timeZone
            ?.takeIf { runCatching { ZoneId.of(it) }.isSuccess }
            ?: "Europe/Warsaw"
        userPushTokenRepository.upsert(principal.userId, request.token, locale, timeZone)
    }

    @Operation(
        summary = "Unregister an Expo push notification token",
        description = "Removes a previously registered push notification token (e.g. upon log out).",
    )
    @DeleteMapping("/api/users/me/push-tokens")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun unregisterPushToken(principal: Principal, @RequestParam token: String) {
        userPushTokenRepository.delete(principal.userId, token)
    }

    @ExceptionHandler(UserNotFoundException::class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    fun handleNotFound(ex: UserNotFoundException): Map<String, String?> = mapOf("error" to ex.message)

    private val Principal.userId: Long
        get() = name.toLong()
}
