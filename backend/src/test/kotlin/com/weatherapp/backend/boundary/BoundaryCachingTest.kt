package com.weatherapp.backend.boundary

import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.times
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.cache.CacheManager
import org.springframework.test.context.bean.override.mockito.MockitoBean
import kotlin.test.assertEquals

@SpringBootTest(
    classes = [
        BoundaryCachingConfig::class,
        TerytResolutionService::class,
    ],
)
class BoundaryCachingTest {

    @MockitoBean
    lateinit var repository: PowiatBoundaryRepository

    @Autowired
    lateinit var service: TerytResolutionService

    @Autowired
    lateinit var cacheManager: CacheManager

    @BeforeEach
    fun resetCache() {
        cacheManager.cacheNames.forEach { cacheManager.getCache(it)?.clear() }
    }

    @Test
    fun `caches teryt resolution for the same coordinates`() {
        whenever(repository.findContainingPoint(52.23, 21.01))
            .thenReturn(PowiatBoundary("1465", "powiat Warszawa", "mazowieckie"))

        val first = service.resolve(52.23, 21.01)
        val second = service.resolve(52.23, 21.01)

        assertEquals(first, second)
        verify(repository, times(1)).findContainingPoint(52.23, 21.01)
    }

    @Test
    fun `caches a miss (point outside all boundaries) too`() {
        whenever(repository.findContainingPoint(0.0, 0.0)).thenReturn(null)

        service.resolve(0.0, 0.0)
        service.resolve(0.0, 0.0)

        verify(repository, times(1)).findContainingPoint(0.0, 0.0)
    }

    @Test
    fun `queries the repository separately for different coordinates`() {
        whenever(repository.findContainingPoint(any(), any()))
            .thenReturn(PowiatBoundary("1465", "powiat Warszawa", "mazowieckie"))

        service.resolve(52.23, 21.01)
        service.resolve(50.06, 19.94)

        verify(repository, times(1)).findContainingPoint(52.23, 21.01)
        verify(repository, times(1)).findContainingPoint(50.06, 19.94)
    }
}
