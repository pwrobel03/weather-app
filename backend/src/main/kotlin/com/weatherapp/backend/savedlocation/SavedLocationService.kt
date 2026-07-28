package com.weatherapp.backend.savedlocation

import com.weatherapp.backend.alert.AlertMatchRepository
import com.weatherapp.backend.boundary.TerytResolutionService
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.stereotype.Service

@Service
class SavedLocationService(
    private val repository: SavedLocationRepository,
    private val terytResolutionService: TerytResolutionService,
    private val alertMatchRepository: AlertMatchRepository,
) {

    fun list(userId: Long): List<SavedLocation> = repository.findAllByUserId(userId)

    /**
     * Resolves TERYT once, here, at save time - not on every read. Locations
     * outside all known powiat boundaries (e.g. abroad) keep a null
     * teryt_code; that's an expected outcome, not an error.
     */
    fun create(userId: Long, name: String, latitude: Double, longitude: Double): SavedLocation {
        val terytCode = terytResolutionService.resolve(latitude, longitude)?.terytCode
        val saved = try {
            repository.create(userId, name, latitude, longitude, terytCode)
        } catch (ex: DataIntegrityViolationException) {
            // DataIntegrityViolationException also fires for the user_id
            // foreign key (e.g. a JWT signed for a user that no longer
            // exists) - only the named unique constraint actually means
            // "already saved". Anything else should surface as a real
            // error, not a misleading 409.
            if (ex.mostSpecificCause.message?.contains("saved_location_user_id_latitude_longitude_key") == true) {
                throw DuplicateSavedLocationException()
            }
            throw ex
        }

        // Match against warnings already in force, rather than leaving it to
        // the next ingest. Someone who saves their home town during a storm
        // has to see that storm now, not up to an ingest interval later - the
        // gap the Faza 7 checkpoint walked straight into.
        alertMatchRepository.recordMatchesForLocation(saved.id)

        return saved
    }

    /**
     * Rewrites the whole order in one go.
     *
     * The request has to name every saved place exactly once. A partial list
     * would leave the places left out with stale positions, silently
     * interleaved among the new ones - so a mismatch is the caller's bug and is
     * rejected rather than half-applied.
     */
    fun reorder(userId: Long, orderedIds: List<Long>) {
        val current = repository.idsInOrder(userId)
        if (orderedIds.size != current.size || orderedIds.toSet() != current.toSet()) {
            throw InvalidSavedLocationOrderException()
        }
        repository.applyOrder(userId, orderedIds)
    }

    fun delete(userId: Long, id: Long) {
        if (!repository.deleteByIdAndUserId(id, userId)) {
            throw SavedLocationNotFoundException(id)
        }
    }
}
