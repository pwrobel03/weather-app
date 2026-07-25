package com.weatherapp.backend.location

import com.weatherapp.backend.openmeteo.OpenMeteoClient
import com.weatherapp.backend.openmeteo.OpenMeteoClientException
import com.weatherapp.backend.openmeteo.OpenMeteoGeocodingResponse
import com.weatherapp.backend.openmeteo.OpenMeteoGeocodingResult
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.web.server.LocalServerPort
import org.springframework.cache.CacheManager
import org.springframework.http.HttpHeaders
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.web.client.HttpServerErrorException
import org.springframework.web.client.RestClient
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

@SpringBootTest(
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = [
        "spring.autoconfigure.exclude=" +
            "org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration," +
            "org.springframework.boot.flyway.autoconfigure.FlywayAutoConfiguration",
    ],
)
class LocationControllerTest {

    @LocalServerPort
    var port: Int = 0

    @MockitoBean
    lateinit var openMeteoClient: OpenMeteoClient

    @Autowired
    lateinit var cacheManager: CacheManager

    @BeforeEach
    fun clearCaches() {
        cacheManager.cacheNames.forEach { cacheManager.getCache(it)?.clear() }
    }

    @Test
    fun `returns geocoding search results for a matching query`() {
        stubUpstreamResponse()

        val body = get("/api/locations/search?query=Warszawa")

        assertTrue(body.contains("\"name\":\"Warszawa\""))
        assertTrue(body.contains("\"countryCode\":\"PL\""))
        assertTrue(body.contains("\"admin1\":\"Województwo Mazowieckie\""))
    }

    @Test
    fun `returns empty list immediately without calling upstream for very short queries`() {
        val body = get("/api/locations/search?query=W")

        assertEquals("[]", body.trim())
        verify(openMeteoClient, never()).searchLocations(any(), any(), any())
    }

    @Test
    fun `sets cache-control and supports conditional requests via etag`() {
        stubUpstreamResponse()
        val client = RestClient.create("http://localhost:$port")

        val first = client.get()
            .uri("/api/locations/search?query=Warszawa")
            .retrieve()
            .toEntity(String::class.java)

        assertEquals("max-age=86400", first.headers.cacheControl)
        val etag = first.headers.eTag
        assertNotNull(etag)

        val second = client.get()
            .uri("/api/locations/search?query=Warszawa")
            .header(HttpHeaders.IF_NONE_MATCH, etag)
            .retrieve()
            .toBodilessEntity()

        assertEquals(304, second.statusCode.value())
    }

    @Test
    fun `returns 502 when the upstream geocoding client fails`() {
        whenever(openMeteoClient.searchLocations(any(), any(), any()))
            .thenThrow(OpenMeteoClientException("boom"))

        val exception = org.junit.jupiter.api.assertThrows<HttpServerErrorException> {
            get("/api/locations/search?query=Warszawa")
        }

        assertEquals(502, exception.statusCode.value())
    }

    private fun get(uri: String): String =
        RestClient.create("http://localhost:$port").get().uri(uri).retrieve().body(String::class.java)!!

    private fun stubUpstreamResponse() {
        whenever(openMeteoClient.searchLocations(any(), any(), any())).thenReturn(
            OpenMeteoGeocodingResponse(
                results = listOf(
                    OpenMeteoGeocodingResult(
                        id = 756135,
                        name = "Warszawa",
                        latitude = 52.22977,
                        longitude = 21.01178,
                        elevation = 113.0,
                        timezone = "Europe/Warsaw",
                        countryCode = "PL",
                        country = "Polska",
                        admin1 = "Województwo Mazowieckie",
                        admin2 = "Warszawa",
                    ),
                ),
            ),
        )
    }
}
