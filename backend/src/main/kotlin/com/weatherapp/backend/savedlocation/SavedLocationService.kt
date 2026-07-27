package com.weatherapp.backend.savedlocation

import com.weatherapp.backend.boundary.TerytResolutionService
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.stereotype.Service

@Service
class SavedLocationService(
    private val repository: SavedLocationRepository,
    private val terytResolutionService: TerytResolutionService,
) {

    fun list(userId: Long): List<SavedLocation> = repository.findAllByUserId(userId)

    /**
     * Resolves TERYT once, here, at save time - not on every read. Locations
     * outside all known powiat boundaries (e.g. abroad) keep a null
     * teryt_code; that's an expected outcome, not an error.
     */
    fun create(userId: Long, name: String, latitude: Double, longitude: Double): SavedLocation {
        val terytCode = terytResolutionService.resolve(latitude, longitude)?.terytCode
        try {
            return repository.create(userId, name, latitude, longitude, terytCode)
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
    }

    fun delete(userId: Long, id: Long) {
        if (!repository.deleteByIdAndUserId(id, userId)) {
            throw SavedLocationNotFoundException(id)
        }
    }
}
