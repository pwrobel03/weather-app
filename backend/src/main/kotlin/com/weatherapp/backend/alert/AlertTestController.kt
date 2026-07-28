package com.weatherapp.backend.alert

import com.weatherapp.backend.boundary.TerytResolutionService
import com.weatherapp.backend.realtime.AlertRealtimeDispatcher
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.tags.Tag
import jakarta.validation.Valid
import jakarta.validation.constraints.DecimalMax
import jakarta.validation.constraints.DecimalMin
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import java.time.Duration
import java.time.Instant
import java.util.UUID

data class TestAlertRequest(
    @field:DecimalMin("-90.0")
    @field:DecimalMax("90.0")
    val latitude: Double,
    @field:DecimalMin("-180.0")
    @field:DecimalMax("180.0")
    val longitude: Double,
    /**
     * 1, 2 or 3, as IMGW grades them; the middle one when omitted.
     *
     * Nullable with the default applied in code rather than a Kotlin default
     * argument: the enum has a `@JsonCreator` taking a String, and an absent
     * property then fails to bind instead of falling back - every request
     * without this field came back 400.
     */
    val severity: WarningSeverity? = null,
)

data class TestAlertResult(val alertId: Long, val terytCode: String, val matchedLocations: Int)

/**
 * Publishes a synthetic warning over the powiat containing a given point.
 *
 * Exists because the whole product cannot be exercised without one. IMGW
 * publishes warnings when the weather warrants them, which on a quiet week is
 * never - so the alert tile, the timeline, the realtime socket and the push
 * notification all went unverified end to end for as long as the sky stayed
 * clear. This is the only way to walk that path deliberately.
 *
 * Two guards, and both matter:
 *
 * The role. A "simulate a warning" button available to users would be one
 * screenshot away from being taken for a real IMGW warning, in an application
 * whose entire credibility rests on that distinction.
 *
 * The wording. The event name says plainly that this is a test, in both
 * languages, so anyone who does see it - on a device, in a screenshot, in the
 * database - can tell at a glance. It is deliberately not a plausible
 * phenomenon name.
 */
@RestController
@Tag(name = "Admin", description = "Administrative maintenance operations")
class AlertTestController(
    private val alertRepository: AlertRepository,
    private val alertMatchRepository: AlertMatchRepository,
    private val alertRealtimeDispatcher: AlertRealtimeDispatcher,
    private val terytResolutionService: TerytResolutionService,
) {

    @Operation(
        summary = "Publish a test warning over a point's powiat",
        description = "Creates a synthetic warning, matches it against saved locations and dispatches it over the " +
            "realtime socket and push, exactly as an ingested one. The event name marks it as a test.",
    )
    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/api/admin/alerts/test")
    fun publishTestAlert(@Valid @RequestBody request: TestAlertRequest): TestAlertResult {
        val teryt = terytResolutionService.resolve(request.latitude, request.longitude)?.terytCode
            ?: throw NoPowiatAtPointException(request.latitude, request.longitude)

        val now = Instant.now()
        val result = alertRepository.upsert(
            AlertDraft(
                // A UUID rather than an IMGW-shaped identifier: upsert keys on
                // this, and a fixed value would silently update the previous
                // test instead of publishing a new one - so the second press of
                // the button would appear to do nothing.
                imgwId = "TEST-${UUID.randomUUID()}",
                event = "TEST — ostrzeżenie próbne / test warning",
                severity = request.severity ?: WarningSeverity.LEVEL_2,
                probabilityPercent = 100,
                validFrom = now,
                validTo = now.plus(Duration.ofHours(2)),
                publishedAt = now,
                content = "Ostrzeżenie wygenerowane ręcznie do testów aplikacji. " +
                    "Nie pochodzi z IMGW i nie opisuje rzeczywistej pogody.",
                comment = null,
                office = "TEST",
                terytCodes = listOf(teryt),
            ),
        )

        val matched = alertMatchRepository.recordMatches(result.alert.id)
        // Through the same dispatcher the ingest uses, or this would verify
        // everything except the part most worth verifying.
        alertRealtimeDispatcher.dispatch(listOf(result.alert))

        return TestAlertResult(alertId = result.alert.id, terytCode = teryt, matchedLocations = matched)
    }

    @ExceptionHandler(NoPowiatAtPointException::class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    fun handleNoPowiat(ex: NoPowiatAtPointException): Map<String, String?> = mapOf("error" to ex.message)
}

class NoPowiatAtPointException(latitude: Double, longitude: Double) :
    RuntimeException("No known powiat contains $latitude, $longitude")
