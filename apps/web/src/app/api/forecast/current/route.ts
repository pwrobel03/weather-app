import { NextResponse, type NextRequest } from "next/server";

import { fetchCurrentConditions } from "@/lib/weather/current-conditions";

/**
 * Same-origin proxy for the client-side refresh fragment (commit 62).
 *
 * The backend has no CORS configuration - deliberately: opening it up is an
 * architectural decision (which origins, whether credentials travel) that
 * hasn't been made, and isn't needed yet. This mirrors the BFF pattern
 * already chosen for the refresh token (commit 64): the browser only ever
 * talks to this Next.js server, which makes the actual backend call itself.
 */
export async function GET(request: NextRequest) {
  const latitude = Number(request.nextUrl.searchParams.get("latitude"));
  const longitude = Number(request.nextUrl.searchParams.get("longitude"));

  if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
    return NextResponse.json({ error: "latitude and longitude query params are required" }, { status: 400 });
  }

  const data = await fetchCurrentConditions(latitude, longitude);
  if (!data) {
    return NextResponse.json({ error: "upstream forecast unavailable" }, { status: 502 });
  }

  return NextResponse.json(data);
}
