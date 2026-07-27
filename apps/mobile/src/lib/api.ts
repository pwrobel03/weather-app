import { createWeatherApiClient, type ApiClient } from "@weather-app/api-client";
import Constants from "expo-constants";

/**
 * Where the backend lives, from the device's point of view.
 *
 * `localhost` is the one answer that is always wrong here: on a simulator it
 * means the simulator, on a physical phone it means the phone. Three sources,
 * most explicit first:
 *
 *  1. EXPO_PUBLIC_API_URL - set it for a real deployment or a tunnel.
 *  2. The dev server's own host. Expo already told the device which machine to
 *     load the bundle from, and the backend is almost always on that same
 *     machine, so we reuse that address with the backend's port.
 *  3. localhost, which only helps in the web preview.
 */
/** Matches `server.port` in backend/src/main/resources/application.yml. */
const API_PORT = 8080;

function resolveBaseUrl(): string {
  const explicit = process.env.EXPO_PUBLIC_API_URL;
  if (explicit) return explicit;

  // "192.168.1.14:8081" while running `expo start`.
  const hostUri = Constants.expoConfig?.hostUri;
  const host = hostUri?.split(":")[0];
  if (host) return `http://${host}:${API_PORT}`;

  return `http://localhost:${API_PORT}`;
}

export const API_BASE_URL = resolveBaseUrl();

export function createApiClient(accessToken?: string): ApiClient {
  return createWeatherApiClient({
    baseUrl: API_BASE_URL,
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
  });
}
