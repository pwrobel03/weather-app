package com.weatherapp.backend.boundary

import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.any
import org.mockito.kotlin.whenever
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.web.server.LocalServerPort
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.web.client.HttpClientErrorException
import org.springframework.web.client.RestClient
import kotlin.test.assertEquals
import kotlin.test.assertTrue

@SpringBootTest(
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = [
        "spring.autoconfigure.exclude=" +
            "org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration," +
            "org.springframework.boot.flyway.autoconfigure.FlywayAutoConfiguration",
    ],
)
class BoundaryControllerTest {

    @LocalServerPort
    var port: Int = 0

    @MockitoBean
    lateinit var terytResolutionService: TerytResolutionService

    @Test
    fun `resolves coordinates to a powiat`() {
        whenever(terytResolutionService.resolve(any(), any()))
            .thenReturn(PowiatBoundary("1465", "powiat Warszawa", "mazowieckie"))

        val body = get("/api/boundaries/resolve?latitude=52.2297&longitude=21.0122")

        assertTrue(body.contains("\"terytCode\":\"1465\""))
        assertTrue(body.contains("\"voivodeship\":\"mazowieckie\""))
    }

    @Test
    fun `returns 404 when no powiat contains the coordinates`() {
        whenever(terytResolutionService.resolve(any(), any())).thenReturn(null)

        val exception = assertThrows<HttpClientErrorException> {
            get("/api/boundaries/resolve?latitude=0&longitude=0")
        }

        assertEquals(404, exception.statusCode.value())
    }

    @Test
    fun `returns a geojson feature for a known teryt code`() {
        whenever(terytResolutionService.getSimplifiedGeoJson("1465")).thenReturn(
            PowiatGeoJsonFeature(
                properties = PowiatGeoJsonFeature.Properties("1465", "powiat Warszawa", "mazowieckie"),
                geometry = """{"type":"MultiPolygon","coordinates":[]}""",
            ),
        )

        val body = get("/api/boundaries/1465/geojson")

        assertTrue(body.contains("\"type\":\"Feature\""))
        assertTrue(body.contains("\"terytCode\":\"1465\""))
        assertTrue(body.contains(""""geometry":{"type":"MultiPolygon","coordinates":[]}"""))
    }

    @Test
    fun `returns 404 for an unknown teryt code`() {
        whenever(terytResolutionService.getSimplifiedGeoJson("9999")).thenReturn(null)

        val exception = assertThrows<HttpClientErrorException> {
            get("/api/boundaries/9999/geojson")
        }

        assertEquals(404, exception.statusCode.value())
    }

    private fun get(uri: String): String =
        RestClient.create("http://localhost:$port").get().uri(uri).retrieve().body(String::class.java)!!
}
