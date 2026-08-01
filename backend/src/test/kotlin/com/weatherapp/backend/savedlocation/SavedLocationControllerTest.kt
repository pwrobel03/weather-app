package com.weatherapp.backend.savedlocation

import com.fasterxml.jackson.databind.DeserializationFeature
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import com.weatherapp.backend.KartozaPostgisContainer
import com.weatherapp.backend.auth.AuthResponse
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.web.server.LocalServerPort
import org.springframework.http.HttpHeaders
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
import kotlin.test.assertEquals
import kotlin.test.assertTrue

@Testcontainers
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class SavedLocationControllerTest {

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
    lateinit var jdbcTemplate: JdbcTemplate

    private lateinit var client: RestClient
    private val objectMapper = jacksonObjectMapper()
        .disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)

    @BeforeEach
    fun setUp() {
        jdbcTemplate.update("TRUNCATE users CASCADE")
        jdbcTemplate.update("TRUNCATE powiat_boundary")
        // Real TERYT code, synthetic geometry - same approach as
        // PowiatBoundaryRepositoryTest (see commit 24).
        jdbcTemplate.update(
            """
            INSERT INTO powiat_boundary (teryt_code, name, voivodeship, boundary)
            VALUES ('1465', 'powiat Warszawa', 'mazowieckie',
                    ST_GeogFromText('MULTIPOLYGON(((20.99 52.21, 20.99 52.25, 21.03 52.25, 21.03 52.21, 20.99 52.21)))'))
            """.trimIndent(),
        )
        client = RestClient.create("http://localhost:$port")
    }

    @Test
    fun `resolves and stores the teryt code for a known coordinate`() {
        val token = registerAndGetAccessToken("teryt@example.com")

        val created = save(token, "Dom", 52.23, 21.01)

        assertEquals("1465", created.terytCode)
    }

    @Test
    fun `stores a null teryt code for coordinates outside all known boundaries`() {
        val token = registerAndGetAccessToken("abroad@example.com")

        val created = save(token, "Zagranica", 0.0, 0.0)

        assertEquals(null, created.terytCode)
    }

    @Test
    fun `rejects listing without a token`() {
        val exception = assertThrows<HttpClientErrorException> {
            client.get().uri("/api/users/me/locations").retrieve().body(String::class.java)
        }
        assertEquals(401, exception.statusCode.value())
    }

    @Test
    fun `creates and lists a saved location`() {
        val token = registerAndGetAccessToken("alice@example.com")

        val created = save(token, "Dom", 52.23, 21.01)
        assertEquals("Dom", created.name)

        val locations = list(token)
        assertEquals(1, locations.size)
        assertEquals("Dom", locations[0].name)
    }

    @Test
    fun `returns an empty list for a user with no saved locations`() {
        val token = registerAndGetAccessToken("nolocations@example.com")

        assertTrue(list(token).isEmpty())
    }

    @Test
    fun `lists multiple saved locations for the same user`() {
        val token = registerAndGetAccessToken("multi@example.com")
        save(token, "Dom", 52.23, 21.01)
        save(token, "Praca", 50.06, 19.94)

        val names = list(token).map { it.name }.toSet()

        assertEquals(setOf("Dom", "Praca"), names)
    }

    @Test
    fun `never returns another user's saved locations`() {
        val aliceToken = registerAndGetAccessToken("isolation-alice@example.com")
        val bobToken = registerAndGetAccessToken("isolation-bob@example.com")
        save(aliceToken, "Alicja dom", 52.23, 21.01)
        save(bobToken, "Bob dom", 50.06, 19.94)

        val aliceLocations = list(aliceToken)

        assertEquals(1, aliceLocations.size)
        assertEquals("Alicja dom", aliceLocations[0].name)
    }

    @Test
    fun `rejects a blank name`() {
        val token = registerAndGetAccessToken("blankname@example.com")

        val exception = assertThrows<HttpClientErrorException> { save(token, "", 52.23, 21.01) }
        assertEquals(400, exception.statusCode.value())
    }

    @Test
    fun `rejects a duplicate save for the same coordinates`() {
        val token = registerAndGetAccessToken("bob@example.com")
        save(token, "Dom", 52.23, 21.01)

        val exception = assertThrows<HttpClientErrorException> { save(token, "Ponownie", 52.23, 21.01) }
        assertEquals(409, exception.statusCode.value())
    }

    @Test
    fun `rejects out-of-range coordinates`() {
        val token = registerAndGetAccessToken("carol@example.com")

        val exception = assertThrows<HttpClientErrorException> { save(token, "Bad", 200.0, 21.01) }
        assertEquals(400, exception.statusCode.value())
    }

    @Test
    fun `deletes a saved location`() {
        val token = registerAndGetAccessToken("dave@example.com")
        val created = save(token, "Dom", 52.23, 21.01)

        client.delete()
            .uri("/api/users/me/locations/${created.id}")
            .header(HttpHeaders.AUTHORIZATION, "Bearer $token")
            .retrieve()
            .toBodilessEntity()

        assertTrue(list(token).isEmpty())
    }

    @Test
    fun `rejects deleting a location that does not belong to the caller`() {
        val ownerToken = registerAndGetAccessToken("erin@example.com")
        val otherToken = registerAndGetAccessToken("frank@example.com")
        val created = save(ownerToken, "Dom", 52.23, 21.01)

        val exception = assertThrows<HttpClientErrorException> {
            client.delete()
                .uri("/api/users/me/locations/${created.id}")
                .header(HttpHeaders.AUTHORIZATION, "Bearer $otherToken")
                .retrieve()
                .toBodilessEntity()
        }
        assertEquals(404, exception.statusCode.value())

        // still there for the actual owner
        assertEquals(1, list(ownerToken).size)
    }

    @Test
    fun `deleting a location that never existed also 404s`() {
        val token = registerAndGetAccessToken("neverexisted@example.com")

        val exception = assertThrows<HttpClientErrorException> {
            client.delete()
                .uri("/api/users/me/locations/999999")
                .header(HttpHeaders.AUTHORIZATION, "Bearer $token")
                .retrieve()
                .toBodilessEntity()
        }
        assertEquals(404, exception.statusCode.value())
    }

    @Test
    fun `saves a new place at the end of the list`() {
        val token = registerAndGetAccessToken("kolejnosc@example.com")

        save(token, "Pierwsze", 52.23, 21.01)
        save(token, "Drugie", 50.06, 19.94)
        save(token, "Trzecie", 54.35, 18.65)

        // Save order is the default order; a list that reshuffles on every
        // save is one nobody bothers arranging.
        assertEquals(listOf("Pierwsze", "Drugie", "Trzecie"), list(token).map { it.name })
    }

    @Test
    fun `reorders the list to exactly what was asked for`() {
        val token = registerAndGetAccessToken("przestaw@example.com")
        val first = save(token, "Pierwsze", 52.23, 21.01)
        val second = save(token, "Drugie", 50.06, 19.94)
        val third = save(token, "Trzecie", 54.35, 18.65)

        reorder(token, listOf(third.id, first.id, second.id))

        assertEquals(listOf("Trzecie", "Pierwsze", "Drugie"), list(token).map { it.name })
    }

    @Test
    fun `the chosen order survives adding another place`() {
        val token = registerAndGetAccessToken("dopisz@example.com")
        val first = save(token, "Pierwsze", 52.23, 21.01)
        val second = save(token, "Drugie", 50.06, 19.94)
        reorder(token, listOf(second.id, first.id))

        save(token, "Nowe", 54.35, 18.65)

        assertEquals(listOf("Drugie", "Pierwsze", "Nowe"), list(token).map { it.name })
    }

    @Test
    fun `rejects an order that leaves a place out`() {
        val token = registerAndGetAccessToken("niepelne@example.com")
        val first = save(token, "Pierwsze", 52.23, 21.01)
        save(token, "Drugie", 50.06, 19.94)

        val exception = assertThrows<HttpClientErrorException> { reorder(token, listOf(first.id)) }

        // Half-applying would leave the omitted place at a stale position,
        // silently interleaved among the new ones.
        assertEquals(400, exception.statusCode.value())
        assertEquals(listOf("Pierwsze", "Drugie"), list(token).map { it.name })
    }

    @Test
    fun `refuses to reorder using somebody else's place`() {
        val mine = registerAndGetAccessToken("moje@example.com")
        val theirs = registerAndGetAccessToken("cudze@example.com")
        val myPlace = save(mine, "Moje", 52.23, 21.01)
        val theirPlace = save(theirs, "Cudze", 50.06, 19.94)

        val exception = assertThrows<HttpClientErrorException> {
            reorder(mine, listOf(myPlace.id, theirPlace.id))
        }

        assertEquals(400, exception.statusCode.value())
        assertEquals(listOf("Cudze"), list(theirs).map { it.name })
    }

    private fun reorder(token: String, orderedIds: List<Long>) {
        client.put()
            .uri("/api/users/me/locations/order")
            .header("Authorization", "Bearer $token")
            .contentType(MediaType.APPLICATION_JSON)
            .body(mapOf("orderedIds" to orderedIds))
            .retrieve()
            .toBodilessEntity()
    }

    private fun registerAndGetAccessToken(email: String): String {
        val json = client.post()
            .uri("/api/auth/register")
            .contentType(MediaType.APPLICATION_JSON)
            .body(mapOf("email" to email, "password" to "correct-horse-battery"))
            .retrieve()
            .body(String::class.java)!!
        return objectMapper.readValue<AuthResponse>(json).accessToken
    }

    private fun save(token: String, name: String, latitude: Double, longitude: Double): SavedLocation {
        val json = client.post()
            .uri("/api/users/me/locations")
            .header(HttpHeaders.AUTHORIZATION, "Bearer $token")
            .contentType(MediaType.APPLICATION_JSON)
            .body(mapOf("name" to name, "latitude" to latitude, "longitude" to longitude))
            .retrieve()
            .body(String::class.java)!!
        return objectMapper.readValue<SavedLocationResponse>(json).toDomain()
    }

    private fun list(token: String): List<SavedLocation> {
        val json = client.get()
            .uri("/api/users/me/locations")
            .header(HttpHeaders.AUTHORIZATION, "Bearer $token")
            .retrieve()
            .body(String::class.java)!!
        return objectMapper.readValue<List<SavedLocationResponse>>(json).map { it.toDomain() }
    }

    // Mirrors the JSON shape without depending on java.time.Instant Jackson
    // module wiring in the test's own ObjectMapper.
    private data class SavedLocationResponse(
        val id: Long,
        val userId: Long,
        val name: String,
        val latitude: Double,
        val longitude: Double,
        val terytCode: String?,
    ) {
        fun toDomain() = SavedLocation(
            id,
            userId,
            name,
            latitude,
            longitude,
            terytCode,
            0,
            com.weatherapp.backend.alert.WarningSeverity.LEVEL_1,
            java.time.Instant.EPOCH,
        )
    }
}
