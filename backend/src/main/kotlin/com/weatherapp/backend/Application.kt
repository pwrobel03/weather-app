package com.weatherapp.backend

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.context.properties.ConfigurationPropertiesScan
import org.springframework.boot.runApplication
import org.springframework.boot.security.autoconfigure.UserDetailsServiceAutoConfiguration

// UserDetailsServiceAutoConfiguration excluded: authentication is fully
// custom (JWT filter reads claims directly, see auth package) and never
// touches Spring's AuthenticationManager/UserDetailsService abstraction, so
// the default in-memory user (logged with a random password on every boot)
// is dead weight that only adds log noise and a theoretically-reachable
// unused credential.
@SpringBootApplication(exclude = [UserDetailsServiceAutoConfiguration::class])
@ConfigurationPropertiesScan
class Application

fun main(args: Array<String>) {
    runApplication<Application>(*args)
}
