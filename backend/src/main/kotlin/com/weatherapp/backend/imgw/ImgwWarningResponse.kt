package com.weatherapp.backend.imgw

import com.fasterxml.jackson.annotation.JsonIgnore
import com.fasterxml.jackson.annotation.JsonIgnoreProperties
import com.fasterxml.jackson.annotation.JsonProperty

/**
 * One entry of GET /api/data/warningsmeteo, mapped as it actually arrives.
 *
 * Everything is a string upstream, including `stopien` and
 * `prawdopodobienstwo` - verified against the live endpoint, not assumed.
 * Parsing into real types happens in the mapper, so an upstream shape change
 * surfaces as a mapping failure that names the offending warning, rather than
 * a deserialisation crash covering the whole batch.
 *
 * The `teryt` array is the entire notion of "area" IMGW provides. There is no
 * geometry anywhere in this contract - a single storm warning routinely covers
 * 50+ powiat codes.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
data class ImgwWarningResponse(
    val id: String,
    @JsonProperty("nazwa_zdarzenia") val nazwaZdarzenia: String,
    val stopien: String,
    val prawdopodobienstwo: String? = null,
    @JsonProperty("obowiazuje_od") val obowiazujeOd: String,
    @JsonProperty("obowiazuje_do") val obowiazujeDo: String,
    val opublikowano: String? = null,
    val tresc: String? = null,
    val komentarz: String? = null,
    val biuro: String? = null,
    // Nullable rather than defaulted: a Kotlin default only applies when the
    // deserialising ObjectMapper has the Kotlin module registered, which makes
    // correctness depend on Jackson configuration rather than on this type.
    // Read through `terytCodes`, never directly.
    val teryt: List<String>? = null,
) {
    /** The warning's area. Absent and empty mean the same thing: matches nobody. */
    @get:JsonIgnore
    val terytCodes: List<String> get() = teryt.orEmpty()
}
