package com.weatherapp.backend.savedlocation

class DuplicateSavedLocationException :
    RuntimeException("This location (same coordinates) is already saved")

class SavedLocationNotFoundException(id: Long) : RuntimeException("No saved location $id for this user")
