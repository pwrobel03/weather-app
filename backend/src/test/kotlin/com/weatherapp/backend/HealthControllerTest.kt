package com.weatherapp.backend

import org.junit.jupiter.api.Test
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.web.server.LocalServerPort
import org.springframework.web.client.RestClient
import kotlin.test.assertEquals

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class HealthControllerTest {

    @LocalServerPort
    var port: Int = 0

    @Test
    fun `health endpoint returns UP`() {
        val client = RestClient.create("http://localhost:$port")
        val body = client.get().uri("/health").retrieve().body(String::class.java)
        assertEquals("""{"status":"UP"}""", body)
    }
}
