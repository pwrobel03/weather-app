package com.weatherapp.backend.openapi

import org.junit.jupiter.api.Test
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.web.server.LocalServerPort
import org.springframework.web.client.RestClient
import java.io.File
import kotlin.test.assertTrue

@SpringBootTest(
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = [
        "spring.autoconfigure.exclude=" +
            "org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration," +
            "org.springframework.boot.flyway.autoconfigure.FlywayAutoConfiguration",
    ],
)
class OpenApiGeneratorTest {

    @LocalServerPort
    var port: Int = 0

    @Test
    fun `generate openapi specification as build artifact`() {
        val client = RestClient.create("http://localhost:$port")
        val json = client.get()
            .uri("/v3/api-docs")
            .retrieve()
            .body(String::class.java)

        requireNotNull(json) { "OpenAPI response body was null" }
        assertTrue(json.contains("\"openapi\":"), "Response should be a valid OpenAPI JSON document")
        assertTrue(json.contains("Weather App API"), "Response should contain API title")
        assertTrue(json.contains("/api/forecast/current"), "Response should contain current conditions endpoint")

        val outputDir = File("build/openapi").apply { mkdirs() }
        File(outputDir, "openapi.json").writeText(json)
    }
}
