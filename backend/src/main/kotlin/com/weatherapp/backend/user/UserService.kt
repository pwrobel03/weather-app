package com.weatherapp.backend.user

import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Service

@Service
class UserService(
    private val userRepository: UserRepository,
    private val passwordEncoder: PasswordEncoder,
) {

    /**
     * The user a device gets before it registers, so that saving a place and
     * receiving a warning do not have to wait for an account.
     */
    fun createAnonymous(): User = userRepository.createAnonymous()

    fun register(email: String, rawPassword: String, displayName: String?): User {
        if (userRepository.findByEmail(email) != null) {
            throw EmailAlreadyRegisteredException(email)
        }
        return userRepository.create(email, passwordEncoder.encode(rawPassword)!!, displayName)
    }

    /**
     * Registers the caller's own anonymous user rather than creating a second
     * one, which is the whole reason anonymous users are `users` rows: the
     * places saved and the push token registered before signing up already
     * belong to this id, so there is nothing to move.
     */
    fun promote(userId: Long, email: String, rawPassword: String, displayName: String?): User {
        val user = userRepository.findById(userId) ?: throw UserNotFoundException(userId)
        if (user.email != null) {
            throw AlreadyRegisteredException(userId)
        }
        if (userRepository.findByEmail(email) != null) {
            throw EmailAlreadyRegisteredException(email)
        }
        userRepository.attachCredentials(userId, email, passwordEncoder.encode(rawPassword)!!, displayName)
        return userRepository.findById(userId)!!
    }

    fun authenticate(email: String, rawPassword: String): User {
        val user = userRepository.findByEmail(email) ?: throw InvalidCredentialsException()
        if (!passwordEncoder.matches(rawPassword, user.passwordHash)) {
            throw InvalidCredentialsException()
        }
        return user
    }

    fun getById(id: Long): User? = userRepository.findById(id)

    /** Nulls in the request leave the corresponding preference unchanged. */
    fun updatePreferences(
        userId: Long,
        temperatureUnit: TemperatureUnit?,
        windSpeedUnit: WindSpeedUnit?,
        precipitationUnit: PrecipitationUnit?,
    ): User {
        val current = userRepository.findById(userId) ?: throw UserNotFoundException(userId)
        userRepository.updatePreferences(
            userId,
            temperatureUnit ?: current.temperatureUnit,
            windSpeedUnit ?: current.windSpeedUnit,
            precipitationUnit ?: current.precipitationUnit,
        )
        return userRepository.findById(userId)!!
    }
}
