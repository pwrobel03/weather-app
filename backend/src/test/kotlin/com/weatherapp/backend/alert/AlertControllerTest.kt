package com.weatherapp.backend.alert

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.weatherapp.backend.KartozaPostgisContainer
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.web.server.LocalServerPort
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.springframework.web.client.HttpClientErrorException
import org.springframework.web.client.RestClient
import org.testcontainers.containers.wait.strategy.Wait
import org.testcontainers.junit.jupiter.Container
import org.testcontainers.junit.jupiter.Testcontainers
import java.time.Duration
import java.time.Instant
import kotlin.test.assertEquals
import kotlin.test.assertTrue

@Testcontainers
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class AlertControllerTest {

    companion object {
        @Container
        @JvmStatic
        val postgres: KartozaPostgisContainer = KartozaPostgisContainer("kartoza/postgis:17-3.5")
            .withExposedPorts(5432)
            .withEnv("POSTGRES_USER", "weather")
            .withEnv("POSTGRES_PASSWORD", "weather")
            .withEnv("POSTGRES_DB", "weather")
            .waitingFor(
                Wait.forLogMessage(".*database system is ready to accept connections.*\\n", 2)
                    .withStartupTimeout(Duration.ofSeconds(90)),
            )

        @JvmStatic
        @DynamicPropertySource
        fun properties(registry: DynamicPropertyRegistry) {
            registry.add("spring.datasource.url") {
                "jdbc:postgresql://${postgres.host}:${postgres.getMappedPort(5432)}/weather"
            }
            registry.add("spring.datasource.username") { "weather" }
            registry.add("spring.datasource.password") { "weather" }
        }
    }

    @LocalServerPort
    var port: Int = 0

    @Autowired
    lateinit var alertRepository: AlertRepository

    @Autowired
    lateinit var matchRepository: AlertMatchRepository

    @Autowired
    lateinit var jdbcTemplate: JdbcTemplate

    private lateinit var client: RestClient
    private val objectMapper = jacksonObjectMapper()

    @BeforeEach
    fun setUp() {
        jdbcTemplate.update("TRUNCATE alert CASCADE")
        jdbcTemplate.update("TRUNCATE users CASCADE")
        client = RestClient.create("http://localhost:$port")
    }

    @Test
    fun `rejects anonymous callers`() {
        val error = try {
            client.get().uri("/api/alerts/active").retrieve().toBodilessEntity()
            throw AssertionError("expected an HTTP error response")
        } catch (ex: HttpClientErrorException) {
            ex
        }
        assertEquals(HttpStatus.UNAUTHORIZED, error.statusCode)
    }

    @Test
    fun `returns alerts covering the user's locations with the affected places named`() {
        val token = register("alice@example.com")
        val userId = userId("alice@example.com")
        createLocation(userId, "Dom", "1465")
        createLocation(userId, "Praca", "1261")

        val alertId = storeAlert(teryt = listOf("1465", "1261"))
        matchRepository.recordMatches(alertId)

        val alerts = activeAlerts(token)

        assertEquals(1, alerts.size)
        assertEquals("Burze", alerts[0]["event"].asText())
        // Severity serialises as IMGW's raw value to match the shared contract.
        assertEquals("1", alerts[0]["severity"].asText())
        assertEquals(
            listOf("Dom", "Praca"),
            alerts[0]["affectedLocations"].map { it["name"].asText() },
        )
    }

    @Test
    fun `does not leak alerts for other accounts`() {
        val aliceToken = register("alice@example.com")
        val bobId = userId(register("bob@example.com").let { "bob@example.com" })
        createLocation(bobId, "Dom", "1465")

        val alertId = storeAlert(teryt = listOf("1465"))
        matchRepository.recordMatches(alertId)

        assertTrue(activeAlerts(aliceToken).isEmpty())
    }

    @Test
    fun `omits warnings that have already expired`() {
        val token = register("alice@example.com")
        createLocation(userId("alice@example.com"), "Dom", "1465")

        val expired = storeAlert(
            teryt = listOf("1465"),
            validFrom = Instant.now().minus(Duration.ofHours(12)),
            validTo = Instant.now().minus(Duration.ofHours(2)),
        )
        matchRepository.recordMatches(expired)

        assertTrue(activeAlerts(token).isEmpty())
    }

    /** IMGW publishes hours ahead; an upcoming storm must still be visible. */
    @Test
    fun `includes warnings that start later`() {
        val token = register("alice@example.com")
        createLocation(userId("alice@example.com"), "Dom", "1465")

        val upcoming = storeAlert(
            teryt = listOf("1465"),
            validFrom = Instant.now().plus(Duration.ofHours(4)),
            validTo = Instant.now().plus(Duration.ofHours(16)),
        )
        matchRepository.recordMatches(upcoming)

        assertEquals(1, activeAlerts(token).size)
    }

    @Test
    fun `orders the most severe warning first`() {
        val token = register("alice@example.com")
        createLocation(userId("alice@example.com"), "Dom", "1465")

        matchRepository.recordMatches(
            storeAlert(imgwId = "low", teryt = listOf("1465"), severity = WarningSeverity.LEVEL_1),
        )
        matchRepository.recordMatches(
            storeAlert(imgwId = "high", teryt = listOf("1465"), severity = WarningSeverity.LEVEL_3),
        )

        assertEquals(listOf("3", "1"), activeAlerts(token).map { it["severity"].asText() })
    }

    private fun activeAlerts(token: String): List<JsonNode> {
        val body = client.get()
            .uri("/api/alerts/active")
            .header("Authorization", "Bearer $token")
            .retrieve()
            .body(String::class.java)!!
        return objectMapper.readTree(body).toList()
    }

    private fun register(email: String): String {
        val body = client.post()
            .uri("/api/auth/register")
            .contentType(MediaType.APPLICATION_JSON)
            .body(mapOf("email" to email, "password" to "correct-horse-battery"))
            .retrieve()
            .body(String::class.java)!!
        return objectMapper.readTree(body)["accessToken"].asText()
    }

    private fun userId(email: String): Long =
        jdbcTemplate.queryForObject("SELECT id FROM users WHERE email = ?", Long::class.java, email)!!

    private fun createLocation(userId: Long, name: String, terytCode: String?) {
        jdbcTemplate.update(
            "INSERT INTO saved_location (user_id, name, latitude, longitude, teryt_code) VALUES (?, ?, ?, ?, ?)",
            userId,
            name,
            name.hashCode() % 90 / 1.0,
            name.hashCode() % 180 / 1.0,
            terytCode,
        )
    }

    private fun storeAlert(
        imgwId: String = "Gd2026072600001",
        teryt: List<String> = listOf("1465"),
        severity: WarningSeverity = WarningSeverity.LEVEL_1,
        validFrom: Instant = Instant.now().minus(Duration.ofHours(1)),
        validTo: Instant = Instant.now().plus(Duration.ofHours(8)),
    ): Long =
        alertRepository.upsert(
            AlertDraft(
                imgwId = imgwId,
                event = "Burze",
                severity = severity,
                probabilityPercent = 80,
                validFrom = validFrom,
                validTo = validTo,
                publishedAt = Instant.now().minus(Duration.ofHours(2)),
                content = "Prognozowane są burze.",
                comment = null,
                office = null,
                terytCodes = teryt,
            ),
        ).alert.id
}
