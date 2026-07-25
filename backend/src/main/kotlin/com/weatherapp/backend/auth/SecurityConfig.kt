package com.weatherapp.backend.auth

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.http.HttpStatus
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity
import org.springframework.security.config.http.SessionCreationPolicy
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.security.web.SecurityFilterChain
import org.springframework.security.web.authentication.HttpStatusEntryPoint
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter

@Configuration
@EnableWebSecurity
class SecurityConfig(private val jwtAuthenticationFilter: JwtAuthenticationFilter) {

    @Bean
    fun passwordEncoder(): PasswordEncoder = BCryptPasswordEncoder()

    // Stateless Bearer-token API - no cookies read by this backend, so CSRF
    // protection (designed for cookie-based session auth) doesn't apply.
    // Weather data (forecast/location/boundary) stays public by product
    // intent - anonymous users can check the weather. Only per-user state
    // (starting with /api/users) requires a valid access token.
    //
    // "/error" must stay public too: a servlet-container error dispatch (e.g.
    // Boot's default error controller after a validation 400) is a second,
    // internal request that also passes through this filter chain. Without
    // this, any error response on an otherwise-public endpoint gets clobbered
    // into a bogus 401 by the authentication entry point below.
    @Bean
    fun securityFilterChain(http: HttpSecurity): SecurityFilterChain {
        http
            .csrf { it.disable() }
            .sessionManagement { it.sessionCreationPolicy(SessionCreationPolicy.STATELESS) }
            .authorizeHttpRequests { auth ->
                auth
                    .requestMatchers(
                        "/health",
                        "/error",
                        "/api/auth/**",
                        "/api/forecast/**",
                        "/api/locations/**",
                        "/api/boundaries/**",
                        "/v3/api-docs/**",
                        "/swagger-ui/**",
                        "/swagger-ui.html",
                    ).permitAll()
                    .anyRequest().authenticated()
            }
            .exceptionHandling { it.authenticationEntryPoint(HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)) }
            .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter::class.java)
        return http.build()
    }
}
