import { createWeatherApiClient } from "@weather-app/api-client";
import { NextResponse, type NextRequest } from "next/server";

const client = createWeatherApiClient(
  process.env.API_BASE_URL ? { baseUrl: process.env.API_BASE_URL } : undefined,
);

/** Same-origin proxy for the client-side location search (commit 65) - same
 * reason as the forecast proxy (commit 62): no backend CORS configuration. */
export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("query") ?? "";

  const { data, response } = await client.GET("/api/locations/search", {
    params: { query: { query } },
  });

  if (!data) {
    return NextResponse.json({ error: "location search unavailable" }, { status: response.status || 502 });
  }

  return NextResponse.json(data);
}
