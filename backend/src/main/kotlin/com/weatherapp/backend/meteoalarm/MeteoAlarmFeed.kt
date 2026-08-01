package com.weatherapp.backend.meteoalarm

import com.fasterxml.jackson.annotation.JsonIgnoreProperties

/**
 * The slice of MeteoAlarm's CAP feed this app uses.
 *
 * Collections are nullable rather than defaulted: a Kotlin default only
 * applies when the deserialising ObjectMapper has the Kotlin module
 * registered, which would make correctness depend on Jackson configuration
 * instead of on the type.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
data class MeteoAlarmFeed(val warnings: List<MeteoAlarmWarning>? = null)

@JsonIgnoreProperties(ignoreUnknown = true)
data class MeteoAlarmWarning(val alert: MeteoAlarmAlert? = null)

@JsonIgnoreProperties(ignoreUnknown = true)
data class MeteoAlarmAlert(
    val identifier: String? = null,
    val info: List<MeteoAlarmInfo>? = null,
)

@JsonIgnoreProperties(ignoreUnknown = true)
data class MeteoAlarmInfo(
    val language: String? = null,
    val event: String? = null,
    val severity: String? = null,
    val urgency: String? = null,
    val certainty: String? = null,
    val headline: String? = null,
    val parameter: List<MeteoAlarmParameter>? = null,
)

@JsonIgnoreProperties(ignoreUnknown = true)
data class MeteoAlarmParameter(
    val valueName: String? = null,
    val value: String? = null,
)
