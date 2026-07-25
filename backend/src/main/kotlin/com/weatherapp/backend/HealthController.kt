package com.weatherapp.backend

import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.tags.Tag
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@Tag(name = "Health", description = "System health check endpoints")
class HealthController {

    @Operation(
        summary = "Check application health status",
        description = "Returns system health status for liveness and readiness monitoring.",
    )
    @GetMapping("/health")
    fun health(): Map<String, String> = mapOf("status" to "UP")
}
