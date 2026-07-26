package com.weatherapp.backend.alert

import com.weatherapp.backend.imgw.ImgwClient
import com.weatherapp.backend.imgw.ImgwClientException
import com.weatherapp.backend.imgw.ImgwWarningResponse
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.any
import org.mockito.kotlin.doAnswer
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.doThrow
import org.mockito.kotlin.mock
import java.time.Instant
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class AlertIngestServiceTest {

    private val mapper = AlertMapper()

    @Test
    fun `stores every warning in the feed`() {
        val service = AlertIngestService(clientReturning(warning("A"), warning("B")), mapper, repositoryTreatingAllAsNew(), matchRepository())

        val result = service.ingest()

        assertEquals(2, result.fetched)
        assertEquals(listOf("A", "B"), result.newAlerts.map { it.imgwId })
        assertTrue(result.updatedAlerts.isEmpty())
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
            repositoryTreatingAllAsNew(),
            matchRepository(),
        )

        val result = service.ingest()

        assertEquals(listOf("A", "C"), result.newAlerts.map { it.imgwId })
        assertEquals(1, result.rejected)
    }

    /**
     * The feed is a snapshot of what is in force, not a stream of events, so
     * an already-known warning must not read as an arrival.
     */
    @Test
    fun `already-known warnings are reported as updates, not arrivals`() {
        val service = AlertIngestService(clientReturning(warning("A")), mapper, repositoryTreatingAllAsKnown(), matchRepository())

        val result = service.ingest()

        assertTrue(result.newAlerts.isEmpty())
        assertEquals(listOf("A"), result.updatedAlerts.map { it.imgwId })
    }

    @Test
    fun `a calm day stores nothing`() {
        val result = AlertIngestService(clientReturning(), mapper, repositoryTreatingAllAsNew(), matchRepository()).ingest()

        assertEquals(0, result.fetched)
        assertTrue(result.newAlerts.isEmpty())
    }

    /** Upstream failure propagates here; the scheduler is what swallows it. */
    @Test
    fun `propagates upstream failures`() {
        val client = mock<ImgwClient> {
            on { fetchMeteoWarnings() } doThrow ImgwClientException("upstream down")
        }

        assertThrows<ImgwClientException> {
            AlertIngestService(client, mapper, repositoryTreatingAllAsNew(), matchRepository()).ingest()
        }
    }

    /** Matching itself is covered against a real database in AlertMatchRepositoryTest. */
    private fun matchRepository(matches: Int = 1): AlertMatchRepository = mock {
        on { recordMatches(any()) } doReturn matches
    }

    private fun repositoryTreatingAllAsNew(): AlertRepository = repositoryReporting(isNew = true)

    private fun repositoryTreatingAllAsKnown(): AlertRepository = repositoryReporting(isNew = false)

    private fun repositoryReporting(isNew: Boolean): AlertRepository = mock {
        on { upsert(any()) } doAnswer { invocation ->
            val draft = invocation.getArgument<AlertDraft>(0)
            AlertUpsertResult(alert = draft.toStoredAlert(), isNew = isNew)
        }
    }

    private fun AlertDraft.toStoredAlert() = Alert(
        id = 1L,
        imgwId = imgwId,
        event = event,
        severity = severity,
        probabilityPercent = probabilityPercent,
        validFrom = validFrom,
        validTo = validTo,
        publishedAt = publishedAt,
        content = content,
        comment = comment,
        office = office,
        terytCodes = terytCodes,
    )

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
