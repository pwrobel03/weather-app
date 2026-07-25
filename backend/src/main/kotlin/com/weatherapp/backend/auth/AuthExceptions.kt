package com.weatherapp.backend.auth

class InvalidRefreshTokenException : RuntimeException("Invalid or expired refresh token")
