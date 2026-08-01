import { NextResponse } from "next/server";

import { refreshSession } from "@/lib/auth/refresh";

/**
 * Meant to be called by client code when an authenticated request 401s, not
 * directly by the user - see refreshSession() for the actual mechanics.
 */
export async function POST() {
  const accessToken = await refreshSession();
  if (!accessToken) {
    return NextResponse.json({ error: "no valid session" }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
