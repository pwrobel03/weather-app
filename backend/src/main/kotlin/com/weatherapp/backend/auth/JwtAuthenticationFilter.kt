package com.weatherapp.backend.auth

import com.weatherapp.backend.user.UserRole
import io.jsonwebtoken.JwtException
import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.security.core.authority.SimpleGrantedAuthority
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
                    // An unrecognised or absent role claim degrades to plain
                    // USER rather than throwing: a token minted before the role
                    // existed must keep working for its remaining TTL, and it
                    // must never fail open into ADMIN.
                    val role = runCatching { UserRole.valueOf(claims[JwtService.CLAIM_ROLE] as String) }
                        .getOrDefault(UserRole.USER)
                    val authorities = listOf(SimpleGrantedAuthority("ROLE_${role.name}"))
                    val authentication = UsernamePasswordAuthenticationToken(claims.subject, null, authorities)
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
