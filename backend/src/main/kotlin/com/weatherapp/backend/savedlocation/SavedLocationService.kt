package com.weatherapp.backend.savedlocation

import org.springframework.dao.DataIntegrityViolationException
import org.springframework.stereotype.Service

@Service
class SavedLocationService(private val repository: SavedLocationRepository) {

    fun list(userId: Long): List<SavedLocation> = repository.findAllByUserId(userId)

    fun create(userId: Long, name: String, latitude: Double, longitude: Double): SavedLocation {
        try {
            return repository.create(userId, name, latitude, longitude, terytCode = null)
        } catch (ex: DataIntegrityViolationException) {
            throw DuplicateSavedLocationException()
        }
    }

    fun delete(userId: Long, id: Long) {
        if (!repository.deleteByIdAndUserId(id, userId)) {
            throw SavedLocationNotFoundException(id)
        }
    }
}
