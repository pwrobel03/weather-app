package com.weatherapp.backend.user

import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Service

@Service
class UserService(
    private val userRepository: UserRepository,
    private val passwordEncoder: PasswordEncoder,
) {

    fun register(email: String, rawPassword: String, displayName: String?): User {
        if (userRepository.findByEmail(email) != null) {
            throw EmailAlreadyRegisteredException(email)
        }
        return userRepository.create(email, passwordEncoder.encode(rawPassword)!!, displayName)
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
