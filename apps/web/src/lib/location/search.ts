import type { components } from "@weather-app/api-client";

export type LocationSearchResult = components["schemas"]["LocationSearchResult"];

export async function searchLocations(query: string): Promise<LocationSearchResult[]> {
  const response = await fetch(`/api/locations/search?query=${encodeURIComponent(query)}`);
  if (!response.ok) {
    throw new Error(`location search failed: ${response.status}`);
  }
  return response.json();
}
