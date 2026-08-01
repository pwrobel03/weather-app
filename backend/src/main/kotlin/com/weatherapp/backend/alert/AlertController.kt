package com.weatherapp.backend.alert

import com.weatherapp.backend.savedlocation.SavedLocationNotFoundException
import com.weatherapp.backend.savedlocation.SavedLocationRepository
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.security.SecurityRequirement
import io.swagger.v3.oas.annotations.tags.Tag
import jakarta.validation.constraints.Max
import jakarta.validation.constraints.Min
import org.springframework.http.HttpStatus
import org.springframework.validation.annotation.Validated
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import java.security.Principal
import java.time.Instant

data class AlertResponse(
    val id: Long,
    val event: String,
    val severity: WarningSeverity,
    val probabilityPercent: Int?,
    val validFrom: Instant,
    val validTo: Instant,
    val publishedAt: Instant?,
    /** Free IMGW text. Polish only, and labelled as coming from IMGW in the UI. */
    val content: String?,
    val comment: String?,
    val office: String?,
    val affectedLocations: List<AffectedLocation>,
    /**
     * Powiat codes this warning covers. Needed by any client that has to
     * answer "does this warning apply *here*" for a place that is not one of
     * the user's saved locations - the home screen's county tile did exactly
     * that, and without this had to guess.
     */
    val terytCodes: List<String>,
) {
    companion object {
        fun from(source: AlertForUser) = AlertResponse(
            id = source.alert.id,
            event = source.alert.event,
            severity = source.alert.severity,
            probabilityPercent = source.alert.probabilityPercent,
            validFrom = source.alert.validFrom,
            validTo = source.alert.validTo,
            publishedAt = source.alert.publishedAt,
            content = source.alert.content,
            comment = source.alert.comment,
            office = source.alert.office,
            affectedLocations = source.affectedLocations,
            terytCodes = source.alert.terytCodes,
        )
    }
}

@RestController
@Validated
@Tag(name = "Alerts", description = "IMGW warnings covering the user's saved locations")
@SecurityRequirement(name = "bearerAuth")
class AlertController(
    private val alertQueryRepository: AlertQueryRepository,
    private val savedLocationRepository: SavedLocationRepository,
) {

    @Operation(
        summary = "Alerts currently in force for the user's saved locations",
        description = "Includes warnings that start later today - IMGW publishes hours ahead, and an upcoming storm is exactly what the user needs to see. Most severe first.",
    )
    @GetMapping("/api/alerts/active")
    fun active(principal: Principal): List<AlertResponse> =
        alertQueryRepository.findActiveForUser(principal.userId).map(AlertResponse::from)

    @Operation(
        summary = "Warning timeline for one saved location",
        description = "Every warning ever recorded for this location, newest first, including expired ones.",
    )
    @GetMapping("/api/users/me/locations/{locationId}/alerts")
    fun history(
        principal: Principal,
        @PathVariable locationId: Long,
        @RequestParam(defaultValue = "50") @Min(1) @Max(200) limit: Int,
    ): List<AlertResponse> {
        // Checked explicitly so an unknown id and someone else's id are
        // indistinguishable from the outside: both 404, neither confirms that
        // the location exists.
        savedLocationRepository.findByIdAndUserId(locationId, principal.userId)
            ?: throw SavedLocationNotFoundException(locationId)

        return alertQueryRepository
            .findHistoryForLocation(principal.userId, locationId, limit)
            .map(AlertResponse::from)
    }

    @ExceptionHandler(SavedLocationNotFoundException::class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    fun handleNotFound(ex: SavedLocationNotFoundException): Map<String, String?> = mapOf("error" to ex.message)

    private val Principal.userId: Long
        get() = name.toLong()
}
