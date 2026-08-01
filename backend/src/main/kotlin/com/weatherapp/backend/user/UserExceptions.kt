package com.weatherapp.backend.user

class EmailAlreadyRegisteredException(email: String) : RuntimeException("Email already registered: $email")

class InvalidCredentialsException : RuntimeException("Invalid email or password")

/** Registration was attempted on a session that already has credentials. */
class AlreadyRegisteredException(id: Long) : RuntimeException("User $id is already registered")

/** The user behind a validated access token no longer exists (e.g. deleted mid-session). */
class UserNotFoundException(id: Long) : RuntimeException("No user $id")
