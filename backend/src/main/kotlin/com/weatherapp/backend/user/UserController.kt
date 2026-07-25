package com.weatherapp.backend.user

import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.security.SecurityRequirement
import io.swagger.v3.oas.annotations.tags.Tag
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RestController
import java.security.Principal

data class UserResponse(
    val id: Long,
    val email: String,
    val displayName: String?,
)

@RestController
@Tag(name = "User", description = "The authenticated user's own profile")
class UserController(private val userService: UserService) {

    @Operation(
        summary = "Get the current user's profile",
        security = [SecurityRequirement(name = "bearerAuth")],
    )
    @GetMapping("/api/users/me")
    fun me(principal: Principal): ResponseEntity<UserResponse> {
        val user = userService.getById(principal.name.toLong()) ?: return ResponseEntity.status(HttpStatus.NOT_FOUND).build()
        return ResponseEntity.ok(UserResponse(user.id, user.email, user.displayName))
    }
}
