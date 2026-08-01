package com.weatherapp.backend.openapi

import io.swagger.v3.oas.models.OpenAPI
import io.swagger.v3.oas.models.info.Info
import io.swagger.v3.oas.models.servers.Server
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration

@Configuration
class OpenApiConfig {

    @Bean
    fun customOpenAPI(): OpenAPI =
        OpenAPI()
            .info(
                Info()
                    .title("Weather App API")
                    .version("0.1.0")
                    .description(
                        "API pogodowe z systemem ostrzeżeń meteorologicznych z IMGW oraz prognozą z Open-Meteo.",
                    ),
            )
            .servers(
                listOf(
                    Server().url("http://localhost:8080").description("Local Development Server"),
                    Server().url("/").description("Relative path (Production / Reverse Proxy)"),
                ),
            )
}
