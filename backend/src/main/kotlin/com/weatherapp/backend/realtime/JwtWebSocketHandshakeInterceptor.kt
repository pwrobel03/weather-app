package com.weatherapp.backend.realtime

import com.weatherapp.backend.auth.JwtService
import io.jsonwebtoken.JwtException
import org.slf4j.LoggerFactory
import org.springframework.http.HttpStatus
import org.springframework.http.server.ServerHttpRequest
import org.springframework.http.server.ServerHttpResponse
import org.springframework.http.server.ServletServerHttpRequest
import org.springframework.stereotype.Component
import org.springframework.web.socket.WebSocketHandler
import org.springframework.web.socket.server.HandshakeInterceptor
import java.lang.Exception

@Component
class JwtWebSocketHandshakeInterceptor(private val jwtService: JwtService) : HandshakeInterceptor {

    private val log = LoggerFactory.getLogger(javaClass)

    override fun beforeHandshake(
        request: ServerHttpRequest,
        response: ServerHttpResponse,
        wsHandler: WebSocketHandler,
        attributes: MutableMap<String, Any>,
    ): Boolean {
        val token = extractToken(request)
        if (token != null) {
            try {
                val claims = jwtService.parse(token)
                if (claims[JwtService.CLAIM_TOKEN_TYPE] == JwtService.TOKEN_TYPE_ACCESS) {
                    val userId = claims.subject.toLong()
                    attributes[ATTR_USER_ID] = userId
                    return true
                }
            } catch (ex: JwtException) {
                log.debug("WebSocket handshake rejected: invalid JWT ({})", ex.message)
            } catch (ex: NumberFormatException) {
                log.debug("WebSocket handshake rejected: subject is not a numeric user ID")
            }
        } else {
            log.debug("WebSocket handshake rejected: missing authentication token")
        }

        response.setStatusCode(HttpStatus.UNAUTHORIZED)
        return false
    }

    override fun afterHandshake(
        request: ServerHttpRequest,
        response: ServerHttpResponse,
        wsHandler: WebSocketHandler,
        exception: Exception?,
    ) {
        // No post-handshake action required
    }

    private fun extractToken(request: ServerHttpRequest): String? {
        if (request is ServletServerHttpRequest) {
            request.servletRequest.getParameter("token")?.let { return it }
        }
        val query = request.uri.query
        if (query != null) {
            for (param in query.split("&")) {
                val parts = param.split("=", limit = 2)
                if (parts.size == 2 && parts[0] == "token") {
                    return parts[1]
                }
            }
        }
        val authHeader = request.headers.getFirst("Authorization")
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            return authHeader.removePrefix("Bearer ").trim()
        }
        return null
    }

    companion object {
        const val ATTR_USER_ID = "userId"
    }
}
