package com.weatherapp.backend.realtime

/**
 * The two sentences a push notification is made of, per language.
 *
 * Deliberately tiny, and deliberately not a mirror of packages/core. The
 * catalogue there is read by two React clients and cannot be reached from
 * Kotlin; duplicating it wholesale would give the project two sources of truth
 * for every string in the app. What is duplicated here is the handful of
 * fragments that only ever get composed on a server, and nowhere else.
 *
 * The phenomenon is *not* translated. IMGW writes it as free text, so
 * translating it here would mean a second copy of the lookup that already
 * lives in packages/core - in another language, drifting the first time either
 * is corrected. A notification therefore reads "Level 2 warning: Silny wiatr":
 * the part we own in the reader's language, the part IMGW owns as IMGW wrote
 * it. That is the promise the app already makes about a warning's body text,
 * applied to its headline.
 */
object PushMessages {

    fun title(locale: String, event: String, severityLevel: String): String =
        when (locale) {
            "en" -> "Level $severityLevel warning: $event"
            else -> "Ostrzeżenie $severityLevel. stopnia: $event"
        }

    fun affects(locale: String, locations: List<String>): String {
        if (locations.isEmpty()) return ""

        val joined = locations.joinToString(", ")
        return when (locale) {
            "en" -> "Affects: $joined. "
            else -> "Dotyczy: $joined. "
        }
    }
}
