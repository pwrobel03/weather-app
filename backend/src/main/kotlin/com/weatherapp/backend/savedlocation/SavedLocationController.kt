package com.weatherapp.backend.savedlocation

import com.weatherapp.backend.alert.WarningSeverity
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.security.SecurityRequirement
import io.swagger.v3.oas.annotations.tags.Tag
import jakarta.validation.Valid
import jakarta.validation.constraints.DecimalMax
import jakarta.validation.constraints.DecimalMin
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.NotEmpty
import jakarta.validation.constraints.Size
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import java.security.Principal

data class SaveLocationRequest(
    @field:NotBlank
    @field:Size(max = 255)
    val name: String,
    @field:DecimalMin("-90.0")
    @field:DecimalMax("90.0")
    val latitude: Double,
    @field:DecimalMin("-180.0")
    @field:DecimalMax("180.0")
    val longitude: Double,
)

/**
 * The one field this endpoint owns.
 *
 * A dedicated request rather than a partial update of the whole place: name
 * and coordinates identify a location and are not editable, so a general PATCH
 * would advertise a capability that does not exist.
 */
data class UpdateMinSeverityRequest(
    val minSeverity: WarningSeverity,
)

data class ReorderRequest(
    @field:NotEmpty
    val orderedIds: List<Long>,
)

@RestController
@Tag(name = "Saved Locations", description = "The authenticated user's saved locations")
@SecurityRequirement(name = "bearerAuth")
class SavedLocationController(private val savedLocationService: SavedLocationService) {

    @Operation(summary = "List the current user's saved locations")
    @GetMapping("/api/users/me/locations")
    fun list(principal: Principal): List<SavedLocation> = savedLocationService.list(principal.userId)

    @Operation(summary = "Save a new location for the current user")
    @PostMapping("/api/users/me/locations")
    @ResponseStatus(HttpStatus.CREATED)
    fun create(principal: Principal, @Valid @RequestBody request: SaveLocationRequest): SavedLocation =
        savedLocationService.create(principal.userId, request.name, request.latitude, request.longitude)

    @Operation(
        summary = "Reorder the current user's saved locations",
        description = "Takes every saved location's id exactly once, in the wanted order. A list that omits or " +
            "repeats any of them is rejected rather than partially applied.",
    )
    @PutMapping("/api/users/me/locations/order")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun reorder(principal: Principal, @Valid @RequestBody request: ReorderRequest) {
        savedLocationService.reorder(principal.userId, request.orderedIds)
    }

    @Operation(
        summary = "Set the lowest warning level worth notifying about at this place",
        description = "Governs notification only. A warning below the threshold is still matched, still " +
            "recorded and still shown on the place's screen - the setting means \"do not wake me for this\".",
    )
    @PatchMapping("/api/users/me/locations/{id}")
    fun updateMinSeverity(
        principal: Principal,
        @PathVariable id: Long,
        @Valid @RequestBody request: UpdateMinSeverityRequest,
    ): SavedLocation = savedLocationService.updateMinSeverity(principal.userId, id, request.minSeverity)

    @Operation(summary = "Delete one of the current user's saved locations")
    @DeleteMapping("/api/users/me/locations/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun delete(principal: Principal, @PathVariable id: Long) {
        savedLocationService.delete(principal.userId, id)
    }

    @ExceptionHandler(DuplicateSavedLocationException::class)
    @ResponseStatus(HttpStatus.CONFLICT)
    fun handleDuplicate(ex: DuplicateSavedLocationException): Map<String, String?> = mapOf("error" to ex.message)

    @ExceptionHandler(InvalidSavedLocationOrderException::class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    fun handleInvalidOrder(ex: InvalidSavedLocationOrderException): Map<String, String?> =
        mapOf("error" to ex.message)

    @ExceptionHandler(SavedLocationNotFoundException::class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    fun handleNotFound(ex: SavedLocationNotFoundException): Map<String, String?> = mapOf("error" to ex.message)

    private val Principal.userId: Long
        get() = name.toLong()
}
