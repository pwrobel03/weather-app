package com.weatherapp.backend.auth

import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.web.filter.OncePerRequestFilter

/**
 * Rejects over-budget callers before the request reaches authentication, so a
 * credential-stuffing run costs the attacker a 429 instead of a BCrypt
 * verification (which is expensive by design and would otherwise make the
 * login endpoint a CPU amplification target).
 */
class RateLimitFilter(private val rateLimiter: RateLimiter) : OncePerRequestFilter() {

    override fun doFilterInternal(
        request: HttpServletRequest,
        response: HttpServletResponse,
        filterChain: FilterChain,
    ) {
        val window = rateLimiter.windowFor(request.method, request.requestURI)
        if (window != null && !window.tryConsume(request.remoteAddr)) {
            response.status = HttpStatus.TOO_MANY_REQUESTS.value()
            response.setHeader(HttpHeaders.RETRY_AFTER, window.retryAfterSeconds.toString())
            response.contentType = MediaType.APPLICATION_JSON_VALUE
            response.writer.write("""{"error":"Too many requests"}""")
            return
        }
        filterChain.doFilter(request, response)
    }
}
