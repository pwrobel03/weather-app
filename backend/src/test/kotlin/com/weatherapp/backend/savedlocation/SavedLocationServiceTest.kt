package com.weatherapp.backend.savedlocation

import com.weatherapp.backend.boundary.TerytResolutionService
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.any
import org.mockito.kotlin.anyOrNull
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.springframework.dao.DataIntegrityViolationException

/**
 * Covers a real bug found while manually verifying commit 66: a JWT signed
 * for a user_id no longer present in the database (e.g. a stale token
 * against a reset dev database) makes the INSERT violate the user_id
 * foreign key - DataIntegrityViolationException fires for that exactly the
 * same as for the named unique constraint, and the service used to map both
 * to "already saved" (409), which is wrong for the former.
 */
class SavedLocationServiceTest {

    private val repository = mock<SavedLocationRepository>()
    private val terytResolutionService = mock<TerytResolutionService>()
    private val service = SavedLocationService(repository, terytResolutionService)

    @Test
    fun `maps the named unique constraint violation to a duplicate error`() {
        whenever(terytResolutionService.resolve(any(), any())).thenReturn(null)
        whenever(repository.create(any(), any(), any(), any(), anyOrNull())).thenThrow(
            DataIntegrityViolationException(
                "insert failed",
                RuntimeException(
                    "duplicate key value violates unique constraint " +
                        "\"saved_location_user_id_latitude_longitude_key\"",
                ),
            ),
        )

        assertThrows<DuplicateSavedLocationException> { service.create(1, "Dom", 52.23, 21.01) }
    }

    @Test
    fun `does not mask an unrelated integrity violation as a duplicate`() {
        whenever(terytResolutionService.resolve(any(), any())).thenReturn(null)
        whenever(repository.create(any(), any(), any(), any(), anyOrNull())).thenThrow(
            DataIntegrityViolationException(
                "insert failed",
                RuntimeException(
                    "insert or update on table \"saved_location\" violates foreign key " +
                        "constraint \"saved_location_user_id_fkey\"",
                ),
            ),
        )

        // If this were (still) mis-mapped to DuplicateSavedLocationException,
        // this assertion on the original exception type would fail.
        assertThrows<DataIntegrityViolationException> { service.create(999, "Dom", 52.23, 21.01) }
    }
}
