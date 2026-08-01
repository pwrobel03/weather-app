package com.weatherapp.backend.forecast

import com.weatherapp.backend.openmeteo.OpenMeteoClient
import org.springframework.stereotype.Service

@Service
class ForecastService(private val openMeteoClient: OpenMeteoClient) {

    fun getForecast(latitude: Double, longitude: Double): Forecast =
        openMeteoClient.fetchForecast(latitude, longitude).toDomain()
}
