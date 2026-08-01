package com.weatherapp.backend.meteoalarm

import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

class CapEnrichmentMapperTest {

    private val mapper = CapEnrichmentMapper()

    @Test
    fun `pulls the imgw id out of the cap identifier`() {
        val result = mapper.toEnrichments(listOf(warning()))

        assertEquals(setOf("Sk20260722102818137"), result.keys)
    }

    @Test
    fun `prefers the english info block`() {
        val enrichment = mapper.toEnrichments(listOf(warning())).values.single()

        assertEquals("Yellow Thunderstorm warning", enrichment.eventEn)
        assertEquals("Moderate", enrichment.severity)
        assertEquals("Expected", enrichment.urgency)
        assertEquals("Likely", enrichment.certainty)
        assertEquals("2; yellow; Moderate", enrichment.awarenessLevel)
        assertEquals("3; Thunderstorm", enrichment.awarenessType)
    }

    /**
     * MeteoAlarm splits one IMGW warning into one CAP alert per powiat - a
     * storm over 50 powiats arrives 50 times with identical metadata. Area is
     * already known from IMGW, so these must collapse to one enrichment.
     */
    @Test
    fun `collapses the per-powiat split into one enrichment`() {
        val perPowiat = listOf("PL2208", "PL2201", "PL2205").map { warning(geocode = it) }

        val result = mapper.toEnrichments(perPowiat)

        assertEquals(1, result.size)
    }

    @Test
    fun `keeps distinct warnings apart`() {
        val result = mapper.toEnrichments(
            listOf(warning(imgwId = "Sk20260722102818137"), warning(imgwId = "Gd20260726100250935")),
        )

        assertEquals(setOf("Sk20260722102818137", "Gd20260726100250935"), result.keys)
    }

    @Test
    fun `falls back to any language when english is absent`() {
        val polishOnly = warning().let { w ->
            w.copy(alert = w.alert!!.copy(info = w.alert!!.info!!.filter { it.language == "pl-PL" }))
        }

        val enrichment = mapper.toEnrichments(listOf(polishOnly)).values.single()

        assertEquals("Ostrzeżenie 1 stopnia przed burzami", enrichment.eventEn)
    }

    @Test
    fun `skips entries whose identifier carries no imgw id`() {
        val malformed = warning().let { w -> w.copy(alert = w.alert!!.copy(identifier = "2.49.0.0.616.0.PL")) }

        assertTrue(mapper.toEnrichments(listOf(malformed)).isEmpty())
    }

    @Test
    fun `tolerates missing parameters`() {
        val bare = warning().let { w ->
            w.copy(alert = w.alert!!.copy(info = listOf(MeteoAlarmInfo(language = "en-GB", event = "Storm"))))
        }

        val enrichment = mapper.toEnrichments(listOf(bare)).values.single()

        assertEquals("Storm", enrichment.eventEn)
        assertNull(enrichment.awarenessLevel)
        assertNull(enrichment.severity)
    }

    @Test
    fun `tolerates an empty feed`() {
        assertTrue(mapper.toEnrichments(emptyList()).isEmpty())
    }

    private fun warning(
        imgwId: String = "Sk20260722102818137",
        geocode: String = "PL2208",
    ) = MeteoAlarmWarning(
        alert = MeteoAlarmAlert(
            identifier = "2.49.0.0.616.0.PL.$imgwId.$geocode",
            info = listOf(
                MeteoAlarmInfo(
                    language = "pl-PL",
                    event = "Ostrzeżenie 1 stopnia przed burzami",
                    severity = "Moderate",
                    urgency = "Expected",
                    certainty = "Likely",
                    parameter = listOf(
                        MeteoAlarmParameter("awareness_level", "2; yellow; Moderate"),
                        MeteoAlarmParameter("awareness_type", "3; Thunderstorm"),
                    ),
                ),
                MeteoAlarmInfo(
                    language = "en-GB",
                    event = "Yellow Thunderstorm warning",
                    severity = "Moderate",
                    urgency = "Expected",
                    certainty = "Likely",
                    parameter = listOf(
                        MeteoAlarmParameter("awareness_level", "2; yellow; Moderate"),
                        MeteoAlarmParameter("awareness_type", "3; Thunderstorm"),
                    ),
                ),
            ),
        ),
    )
}
