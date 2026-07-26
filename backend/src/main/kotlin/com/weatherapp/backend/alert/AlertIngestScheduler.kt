package com.weatherapp.backend.alert

import com.weatherapp.backend.imgw.ImgwClientException
import org.slf4j.LoggerFactory
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.context.annotation.Configuration
import org.springframework.scheduling.annotation.EnableScheduling
import org.springframework.scheduling.annotation.SchedulingConfigurer
import org.springframework.scheduling.config.FixedDelayTask
import org.springframework.scheduling.config.ScheduledTaskRegistrar

/**
 * Polls IMGW on a fixed delay.
 *
 * The task is registered programmatically rather than with @Scheduled so the
 * interval comes from [AlertIngestProperties] itself. A `fixedDelayString`
 * would read the raw property independently, leaving the typed property unused
 * and free to drift from what actually runs.
 *
 * Fixed *delay*, not fixed rate: the gap is measured after each run finishes,
 * so a slow upstream cannot stack overlapping polls.
 *
 * A single scheduler in a single process is exactly what the chosen deployment
 * topology allows (one backend instance, follow-up.md point 4). More than one
 * instance would need a lock here, or every instance would fetch and process
 * the same warnings in parallel.
 *
 * Disabled wholesale via `alert-ingest.enabled=false`, which is how tests keep
 * their hands off the live public feed.
 */
@Configuration
@EnableScheduling
@ConditionalOnProperty(prefix = "alert-ingest", name = ["enabled"], havingValue = "true", matchIfMissing = true)
class AlertIngestScheduler(
    private val alertIngestService: AlertIngestService,
    private val properties: AlertIngestProperties,
) : SchedulingConfigurer {

    private val log = LoggerFactory.getLogger(javaClass)

    override fun configureTasks(registrar: ScheduledTaskRegistrar) {
        registrar.addFixedDelayTask(
            FixedDelayTask(
                Runnable { pollWarnings() },
                properties.interval,
                properties.initialDelay,
            ),
        )
    }

    fun pollWarnings() {
        try {
            alertIngestService.ingest()
        } catch (ex: ImgwClientException) {
            // Upstream being down must not kill the schedule - the next tick
            // still has to run. Logged rather than rethrown for that reason.
            log.error("IMGW warning ingest failed; will retry on the next tick", ex)
        }
    }
}
