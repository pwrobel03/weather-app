package com.weatherapp.backend.alert

import com.weatherapp.backend.imgw.ImgwClient
import com.weatherapp.backend.imgw.ImgwClientException
import com.weatherapp.backend.imgw.ImgwWarningResponse
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.doThrow
import org.mockito.kotlin.mock
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class AlertIngestServiceTest {

    private val mapper = AlertMapper()

    @Test
    fun `maps every warning in the feed`() {
        val service = AlertIngestService(clientReturning(warning("A"), warning("B")), mapper)

        val drafts = service.ingest()

        assertEquals(listOf("A", "B"), drafts.map { it.imgwId })
    }

    /**
     * The point of the whole method: a storm warning covering 50 powiats must
     * not be lost because an unrelated warning arrived malformed.
     */
    @Test
    fun `one unmappable warning does not cost the rest of the batch`() {
        val service = AlertIngestService(
            clientReturning(warning("A"), warning("BROKEN", stopien = "9"), warning("C")),
            mapper,
        )

        val drafts = service.ingest()

        assertEquals(listOf("A", "C"), drafts.map { it.imgwId })
    }

    @Test
    fun `a calm day maps to no drafts`() {
        assertTrue(AlertIngestService(clientReturning(), mapper).ingest().isEmpty())
    }

    /** Upstream failure propagates here; the scheduler is what swallows it. */
    @Test
    fun `propagates upstream failures`() {
        val client = mock<ImgwClient> {
            on { fetchMeteoWarnings() } doThrow ImgwClientException("upstream down")
        }

        assertThrows<ImgwClientException> { AlertIngestService(client, mapper).ingest() }
    }

    private fun clientReturning(vararg warnings: ImgwWarningResponse): ImgwClient =
        mock { on { fetchMeteoWarnings() } doReturn warnings.toList() }

    private fun warning(id: String, stopien: String = "1") = ImgwWarningResponse(
        id = id,
        nazwaZdarzenia = "Burze",
        stopien = stopien,
        prawdopodobienstwo = "80",
        obowiazujeOd = "2026-07-26 22:00:00",
        obowiazujeDo = "2026-07-27 10:00:00",
        opublikowano = "2026-07-26 12:02:00",
        tresc = "Prognozowane są burze.",
        komentarz = null,
        biuro = null,
        teryt = listOf("1465"),
    )
}
