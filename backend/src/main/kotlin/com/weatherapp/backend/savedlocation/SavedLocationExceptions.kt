package com.weatherapp.backend.savedlocation

class DuplicateSavedLocationException :
    RuntimeException("This location (same coordinates) is already saved")

class SavedLocationNotFoundException(id: Long) : RuntimeException("No saved location $id for this user")

/** The submitted order does not name exactly the user's saved locations. */
class InvalidSavedLocationOrderException :
    RuntimeException("The order must list every saved location exactly once")
