package com.weatherapp.backend.realtime

import org.springframework.boot.context.properties.ConfigurationProperties

/**
 * Where FCM lives and how we prove who we are.
 *
 * `serviceAccountJson` is the whole key file, not a path: on a hosted backend
 * it arrives as an environment variable, and a path would mean writing a secret
 * to disk on every deploy to satisfy a reader that could have taken the value
 * directly.
 *
 * Empty by default, and that is a supported state rather than a misconfiguration
 * to crash on. A developer running the stack locally has no key, and a backend
 * that refuses to start without one would make push a prerequisite for working
 * on the forecast.
 */
@ConfigurationProperties(prefix = "fcm")
data class FcmProperties(
    val baseUrl: String = "https://fcm.googleapis.com",
    val projectId: String = "",
    val serviceAccountJson: String = "",
) {
    val isConfigured: Boolean
        get() = projectId.isNotBlank() && serviceAccountJson.isNotBlank()
}
