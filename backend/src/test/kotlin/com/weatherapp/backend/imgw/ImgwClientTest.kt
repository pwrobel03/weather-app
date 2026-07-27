package com.weatherapp.backend.imgw

import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.test.web.client.MockRestServiceServer
import org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo
import org.springframework.test.web.client.response.MockRestResponseCreators.withServerError
import org.springframework.test.web.client.response.MockRestResponseCreators.withStatus
import org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess
import org.springframework.web.client.RestClient
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class ImgwClientTest {

    private lateinit var mockServer: MockRestServiceServer
    private lateinit var client: ImgwClient

    @BeforeEach
    fun setUp() {
        val builder = RestClient.builder()
        mockServer = MockRestServiceServer.bindTo(builder).build()
        client = ImgwClient(builder, ImgwProperties(baseUrl = BASE_URL))
    }

    @Test
    fun `maps a warning with its full teryt area list`() {
        mockServer.expect(requestTo("$BASE_URL/api/data/warningsmeteo"))
            .andRespond(withSuccess(WARNINGS_JSON, MediaType.APPLICATION_JSON))

        val warnings = client.fetchMeteoWarnings()

        assertEquals(2, warnings.size)
        val storm = warnings.first()
        assertEquals("Gd20260726100250935", storm.id)
        assertEquals("Burze", storm.nazwaZdarzenia)
        // Numeric-looking fields arrive as strings upstream; kept verbatim here.
        assertEquals("1", storm.stopien)
        assertEquals("80", storm.prawdopodobienstwo)
        assertEquals("2026-07-26 22:00:00", storm.obowiazujeOd)
        assertEquals("2026-07-27 10:00:00", storm.obowiazujeDo)
        assertEquals(listOf("3029", "2801", "3030"), storm.terytCodes)
    }

    @Test
    fun `tolerates missing optional fields`() {
        mockServer.expect(requestTo("$BASE_URL/api/data/warningsmeteo"))
            .andRespond(withSuccess(WARNINGS_JSON, MediaType.APPLICATION_JSON))

        val sparse = client.fetchMeteoWarnings()[1]

        assertEquals("Upał", sparse.nazwaZdarzenia)
        assertEquals(null, sparse.prawdopodobienstwo)
        assertEquals(null, sparse.komentarz)
        assertTrue(sparse.terytCodes.isEmpty())
    }

    /** A calm day is `[]`, and must read as "no warnings", not as a failure. */
    @Test
    fun `an empty feed is a valid response`() {
        mockServer.expect(requestTo("$BASE_URL/api/data/warningsmeteo"))
            .andRespond(withSuccess("[]", MediaType.APPLICATION_JSON))

        assertTrue(client.fetchMeteoWarnings().isEmpty())
    }

    /**
     * The real calm-day response, verified against the live endpoint on
     * 2026-07-27 while nothing was in force anywhere in Poland.
     *
     * Getting this wrong means the ingest throws on every run of every quiet
     * day, so warnings that have ended are never cleared and the app cannot
     * get back from "warning in force" to "all quiet" - the wrong way round for
     * a warning app, where the calm case has to be the reliable one.
     */
    @Test
    fun `a 404 means no warnings are in force, not a failure`() {
        mockServer.expect(requestTo("$BASE_URL/api/data/warningsmeteo"))
            .andRespond(
                withStatus(HttpStatus.NOT_FOUND)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body("""{"status":false,"message":"No products were found"}"""),
            )

        assertTrue(client.fetchMeteoWarnings().isEmpty())
    }

    @Test
    fun `wraps upstream errors in a client exception`() {
        mockServer.expect(requestTo("$BASE_URL/api/data/warningsmeteo"))
            .andRespond(withServerError())

        assertThrows<ImgwClientException> { client.fetchMeteoWarnings() }
    }

    private companion object {
        const val BASE_URL = "https://imgw.test"

        // Shape copied from the live endpoint on 2026-07-26, trimmed to two
        // entries and a shorter teryt list.
        val WARNINGS_JSON = """
            [
              {
                "id": "Gd20260726100250935",
                "nazwa_zdarzenia": "Burze",
                "stopien": "1",
                "prawdopodobienstwo": "80",
                "obowiazuje_do": "2026-07-27 10:00:00",
                "obowiazuje_od": "2026-07-26 22:00:00",
                "opublikowano": "2026-07-26 12:02:00",
                "tresc": "Prognozowane są burze, którym miejscami będą towarzyszyć silne opady deszczu.",
                "komentarz": "Brak.",
                "biuro": "Centralne Biuro Prognoz Meteorologicznych w Warszawie",
                "teryt": ["3029", "2801", "3030"]
              },
              {
                "id": "Wa20260726110000001",
                "nazwa_zdarzenia": "Upał",
                "stopien": "2",
                "obowiazuje_do": "2026-07-28 20:00:00",
                "obowiazuje_od": "2026-07-27 12:00:00",
                "tresc": "Prognozowana jest temperatura maksymalna od 30 do 32 st. C."
              }
            ]
        """.trimIndent()
    }
}
