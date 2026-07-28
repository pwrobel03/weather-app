package com.weatherapp.backend.user

import org.slf4j.LoggerFactory
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.context.annotation.Configuration
import org.springframework.scheduling.annotation.EnableScheduling
import org.springframework.scheduling.annotation.SchedulingConfigurer
import org.springframework.scheduling.config.FixedDelayTask
import org.springframework.scheduling.config.ScheduledTaskRegistrar

/**
 * Runs [AnonymousCleanupService] on a fixed delay, in the shape the warning
 * ingest scheduler already established: the interval comes from the typed
 * properties rather than from a raw `fixedDelayString`, so what runs and what
 * is configured cannot drift apart.
 *
 * Disabled wholesale via `anonymous-cleanup.enabled=false`, which is how a test
 * keeps the sweep from firing underneath it.
 */
@Configuration
@EnableScheduling
@ConditionalOnProperty(
    prefix = "anonymous-cleanup",
    name = ["enabled"],
    havingValue = "true",
    matchIfMissing = true,
)
class AnonymousCleanupScheduler(
    private val service: AnonymousCleanupService,
    private val properties: AnonymousCleanupProperties,
) : SchedulingConfigurer {

    private val log = LoggerFactory.getLogger(javaClass)

    override fun configureTasks(registrar: ScheduledTaskRegistrar) {
        registrar.addFixedDelayTask(
            FixedDelayTask(Runnable { sweep() }, properties.interval, properties.initialDelay),
        )
    }

    fun sweep() {
        try {
            service.sweep()
        } catch (ex: org.springframework.dao.DataAccessException) {
            // A failed sweep must not kill the schedule; the rows are still
            // dead on the next tick.
            log.error("Anonymous cleanup failed; will retry on the next tick", ex)
        }
    }
}
