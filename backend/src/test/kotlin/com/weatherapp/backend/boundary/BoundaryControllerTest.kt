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
import kotlin.test.assertNull
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

    @Test
    fun `returns a feature collection for several teryt codes in one request`() {
        whenever(terytResolutionService.getSimplifiedGeoJson(listOf("1465", "1401"))).thenReturn(
            PowiatGeoJsonFeatureCollection(
                listOf(
                    feature("1401", "powiat bialski"),
                    feature("1465", "powiat Warszawa"),
                ),
            ),
        )

        val body = get("/api/boundaries/geojson?teryt=1465,1401")

        assertTrue(body.contains("\"type\":\"FeatureCollection\""))
        assertTrue(body.contains("\"terytCode\":\"1465\""))
        assertTrue(body.contains("\"terytCode\":\"1401\""))
    }

    @Test
    fun `returns an empty collection rather than 404 when no code is known`() {
        // A warning naming a powiat we have no boundary for should leave that
        // one unpainted, not fail the whole map.
        whenever(terytResolutionService.getSimplifiedGeoJson(listOf("9999")))
            .thenReturn(PowiatGeoJsonFeatureCollection(emptyList()))

        val body = get("/api/boundaries/geojson?teryt=9999")

        assertTrue(body.contains("\"features\":[]"))
    }

    @Test
    fun `rejects an over-long code list as a client error`() {
        whenever(terytResolutionService.getSimplifiedGeoJson(any<List<String>>()))
            .thenThrow(IllegalArgumentException("at most 400 teryt codes per request, got 401"))

        val exception = assertThrows<HttpClientErrorException> {
            get("/api/boundaries/geojson?teryt=" + (1..401).joinToString(",") { "1465" })
        }

        // 400, not 500: the caller built a bad URL, the server is fine.
        assertEquals(400, exception.statusCode.value())
    }

    @Test
    fun `serves boundary geometry with a long-lived public cache directive`() {
        whenever(terytResolutionService.datasetVersion()).thenReturn("18f2c")
        whenever(terytResolutionService.getSimplifiedGeoJson("1465")).thenReturn(feature("1465", "powiat Warszawa"))

        val response = RestClient.create("http://localhost:$port")
            .get().uri("/api/boundaries/1465/geojson").retrieve().toEntity(String::class.java)

        val cacheControl = response.headers.getFirst("Cache-Control")!!
        assertTrue(cacheControl.contains("max-age=86400"), cacheControl)
        // Public: the endpoint is unauthenticated and the response depends on
        // nothing about the caller, so a shared cache may hold one copy.
        assertTrue(cacheControl.contains("public"), cacheControl)
        assertTrue(response.headers.eTag != null)
    }

    @Test
    fun `answers a revalidation with 304 and no body`() {
        whenever(terytResolutionService.datasetVersion()).thenReturn("18f2c")
        whenever(terytResolutionService.getSimplifiedGeoJson("1465")).thenReturn(feature("1465", "powiat Warszawa"))

        val client = RestClient.create("http://localhost:$port")
        val etag = client.get().uri("/api/boundaries/1465/geojson")
            .retrieve().toEntity(String::class.java).headers.eTag!!

        val revalidated = client.get().uri("/api/boundaries/1465/geojson")
            .header("If-None-Match", etag)
            .retrieve().toEntity(String::class.java)

        assertEquals(304, revalidated.statusCode.value())
        assertNull(revalidated.body)
    }

    @Test
    fun `does not reuse one code list's etag for another`() {
        whenever(terytResolutionService.datasetVersion()).thenReturn("18f2c")
        whenever(terytResolutionService.getSimplifiedGeoJson(any<List<String>>()))
            .thenReturn(PowiatGeoJsonFeatureCollection(listOf(feature("1465", "powiat Warszawa"))))

        val client = RestClient.create("http://localhost:$port")
        val warsaw = client.get().uri("/api/boundaries/geojson?teryt=1465")
            .retrieve().toEntity(String::class.java).headers.eTag!!

        // Same dataset, different request. Sharing a tag here would serve one
        // powiat's polygons under another's URL - wrong shapes, 200 OK, no
        // error anywhere.
        val other = client.get().uri("/api/boundaries/geojson?teryt=1401")
            .header("If-None-Match", warsaw)
            .retrieve().toEntity(String::class.java)

        assertEquals(200, other.statusCode.value())
    }

    @Test
    fun `refuses to cache anything before the dataset has been imported`() {
        // No boundaries yet: without this, a client caches an empty map for a
        // day and the import that follows changes nothing it can see.
        whenever(terytResolutionService.datasetVersion()).thenReturn(null)
        whenever(terytResolutionService.getSimplifiedGeoJson(any<List<String>>()))
            .thenReturn(PowiatGeoJsonFeatureCollection(emptyList()))

        val response = RestClient.create("http://localhost:$port")
            .get().uri("/api/boundaries/geojson?teryt=1465").retrieve().toEntity(String::class.java)

        assertTrue(response.headers.getFirst("Cache-Control")!!.contains("no-store"))
    }

    private fun feature(terytCode: String, name: String) =
        PowiatGeoJsonFeature(
            properties = PowiatGeoJsonFeature.Properties(terytCode, name, "mazowieckie"),
            geometry = """{"type":"MultiPolygon","coordinates":[]}""",
        )

    private fun get(uri: String): String =
        RestClient.create("http://localhost:$port").get().uri(uri).retrieve().body(String::class.java)!!
}
