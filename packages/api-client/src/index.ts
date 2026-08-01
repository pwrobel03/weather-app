import createClient, { type Client, type ClientOptions } from "openapi-fetch";
import type { paths } from "./generated/schema.js";

export type { paths, components, operations } from "./generated/schema.js";
export type ApiClient = Client<paths>;

/**
 * Creates a type-safe HTTP client for the Weather App backend API.
 *
 * @param options - openapi-fetch configuration options (e.g. baseUrl, custom fetch, headers)
 * @returns Strongly typed client for accessing /api/forecast/* and other endpoints
 */
export function createWeatherApiClient(options?: ClientOptions): ApiClient {
  return createClient<paths>({
    baseUrl: "http://localhost:8080",
    ...options,
  });
}
