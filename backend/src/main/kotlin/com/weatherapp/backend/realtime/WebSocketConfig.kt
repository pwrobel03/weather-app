package com.weatherapp.backend.realtime

import org.springframework.context.annotation.Configuration
import org.springframework.web.socket.config.annotation.EnableWebSocket
import org.springframework.web.socket.config.annotation.WebSocketConfigurer
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry

@Configuration
@EnableWebSocket
class WebSocketConfig(
    private val alertWebSocketHandler: AlertWebSocketHandler,
    private val jwtWebSocketHandshakeInterceptor: JwtWebSocketHandshakeInterceptor,
) : WebSocketConfigurer {

    override fun registerWebSocketHandlers(registry: WebSocketHandlerRegistry) {
        registry.addHandler(alertWebSocketHandler, "/api/ws/alerts")
            .addInterceptors(jwtWebSocketHandshakeInterceptor)
            .setAllowedOriginPatterns("*")
    }
}
