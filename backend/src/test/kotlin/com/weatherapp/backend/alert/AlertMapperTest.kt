package com.weatherapp.backend.alert

import com.weatherapp.backend.imgw.ImgwWarningResponse
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import java.time.Instant
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

class AlertMapperTest {

    private val mapper = AlertMapper()

    @Test
    fun `maps a storm warning with its full area list`() {
        val draft = mapper.toDraft(warning(teryt = listOf("1465", "1261", "3029")))

        assertEquals("Gd20260726100250935", draft.imgwId)
        assertEquals("Burze", draft.event)
        assertEquals(WarningSeverity.LEVEL_1, draft.severity)
        assertEquals(80, draft.probabilityPercent)
        assertEquals(listOf("1465", "1261", "3029"), draft.terytCodes)
    }

    /**
     * The whole point of this test: "2026-07-26 22:00:00" is Polish local time,
     * so in CEST it is 20:00Z. Reading it as UTC would shift every warning's
     * validity window by two hours.
     */
    @Test
    fun `interprets naive timestamps as Polish local time`() {
        val draft = mapper.toDraft(warning())

        assertEquals(Instant.parse("2026-07-26T20:00:00Z"), draft.validFrom)
        assertEquals(Instant.parse("2026-07-27T08:00:00Z"), draft.validTo)
        assertEquals(Instant.parse("2026-07-26T10:02:00Z"), draft.publishedAt)
    }

    /** Winter is +01:00, so a fixed offset would be wrong half the year. */
    @Test
    fun `handles the winter offset too`() {
        val draft = mapper.toDraft(
            warning(validFrom = "2026-01-15 22:00:00", validTo = "2026-01-16 10:00:00"),
        )

        assertEquals(Instant.parse("2026-01-15T21:00:00Z"), draft.validFrom)
        assertEquals(Instant.parse("2026-01-16T09:00:00Z"), draft.validTo)
    }

    @Test
    fun `maps all three severity levels`() {
        assertEquals(WarningSeverity.LEVEL_1, mapper.toDraft(warning(stopien = "1")).severity)
        assertEquals(WarningSeverity.LEVEL_2, mapper.toDraft(warning(stopien = "2")).severity)
        assertEquals(WarningSeverity.LEVEL_3, mapper.toDraft(warning(stopien = "3")).severity)
    }

    @Test
    fun `rejects an unknown severity rather than guessing`() {
        val ex = assertThrows<AlertMappingException> { mapper.toDraft(warning(stopien = "9")) }
        assertTrue(ex.message!!.contains("Gd20260726100250935"))
    }

    @Test
    fun `rejects an unparseable timestamp and names the field`() {
        val ex = assertThrows<AlertMappingException> { mapper.toDraft(warning(validFrom = "wczoraj")) }
        assertTrue(ex.message!!.contains("obowiazuje_od"))
    }

    /** A missing probability must not cost us an otherwise valid warning. */
    @Test
    fun `degrades a missing or non-numeric probability to null`() {
        assertNull(mapper.toDraft(warning(probability = null)).probabilityPercent)
        assertNull(mapper.toDraft(warning(probability = "wysokie")).probabilityPercent)
    }

    @Test
    fun `treats an absent area list as covering nobody`() {
        assertTrue(mapper.toDraft(warning(teryt = null)).terytCodes.isEmpty())
    }

    private fun warning(
        stopien: String = "1",
        probability: String? = "80",
        validFrom: String = "2026-07-26 22:00:00",
        validTo: String = "2026-07-27 10:00:00",
        teryt: List<String>? = listOf("1465"),
    ) = ImgwWarningResponse(
        id = "Gd20260726100250935",
        nazwaZdarzenia = "Burze",
        stopien = stopien,
        prawdopodobienstwo = probability,
        obowiazujeOd = validFrom,
        obowiazujeDo = validTo,
        opublikowano = "2026-07-26 12:02:00",
        tresc = "Prognozowane są burze.",
        komentarz = "Brak.",
        biuro = "Centralne Biuro Prognoz Meteorologicznych w Warszawie",
        teryt = teryt,
    )
}
