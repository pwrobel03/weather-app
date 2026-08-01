import { NextResponse } from "next/server";

import { getAccessToken } from "@/lib/auth/session";

/**
 * Hands the browser the access token so it can open the alert WebSocket.
 *
 * Necessary because the session lives in HttpOnly cookies that JS cannot read,
 * and the browser WebSocket API allows neither custom headers nor cookies on a
 * cross-origin handshake - the backend therefore reads the token from the
 * query string.
 *
 * The trade-off is explicit: for the lifetime of the page, the access token is
 * reachable from JavaScript, so an XSS could take it. It is the short-lived
 * token (15 min), never the refresh token, so the blast radius is bounded.
 *
 * The proper fix is a single-use ticket the backend exchanges for a session at
 * handshake time, which is noted as an open item from the Faza 5 review rather
 * than invented here.
 */
export async function GET() {
  const token = await getAccessToken();
  if (!token) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  return NextResponse.json(
    { token },
    // Never cached, anywhere: this is a credential.
    { headers: { "Cache-Control": "no-store, private" } },
  );
}
