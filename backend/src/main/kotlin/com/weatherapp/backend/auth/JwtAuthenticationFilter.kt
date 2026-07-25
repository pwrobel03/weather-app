package com.weatherapp.backend.auth

import io.jsonwebtoken.JwtException
import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.stereotype.Component
import org.springframework.web.filter.OncePerRequestFilter

@Component
class JwtAuthenticationFilter(private val jwtService: JwtService) : OncePerRequestFilter() {

    override fun doFilterInternal(request: HttpServletRequest, response: HttpServletResponse, filterChain: FilterChain) {
        val header = request.getHeader("Authorization")
        if (header != null && header.startsWith("Bearer ")) {
            val token = header.removePrefix("Bearer ")
            try {
                val claims = jwtService.parse(token)
                if (claims[JwtService.CLAIM_TOKEN_TYPE] == JwtService.TOKEN_TYPE_ACCESS) {
                    val authentication = UsernamePasswordAuthenticationToken(claims.subject, null, emptyList())
                    SecurityContextHolder.getContext().authentication = authentication
                }
            } catch (ex: JwtException) {
                // Leave the request unauthenticated; downstream authorization
                // (once enforced, see commit 29) rejects it if needed.
            }
        }
        filterChain.doFilter(request, response)
    }
}
