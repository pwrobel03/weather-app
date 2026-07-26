package com.weatherapp.backend.alert

import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.security.SecurityRequirement
import io.swagger.v3.oas.annotations.tags.Tag
import org.springframework.web.bind.annotation.GetMapping
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
        )
    }
}

@RestController
@Tag(name = "Alerts", description = "IMGW warnings covering the user's saved locations")
@SecurityRequirement(name = "bearerAuth")
class AlertController(private val alertQueryRepository: AlertQueryRepository) {

    @Operation(
        summary = "Alerts currently in force for the user's saved locations",
        description = "Includes warnings that start later today - IMGW publishes hours ahead, and an upcoming storm is exactly what the user needs to see. Most severe first.",
    )
    @GetMapping("/api/alerts/active")
    fun active(principal: Principal): List<AlertResponse> =
        alertQueryRepository.findActiveForUser(principal.userId).map(AlertResponse::from)

    private val Principal.userId: Long
        get() = name.toLong()
}
