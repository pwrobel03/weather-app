import "server-only";

import { cookies } from "next/headers";

const ACTIVE_LOCATION_COOKIE = "wx_active_location";

// A year is arbitrary but long - this is a UI preference, not a session, so
// it should outlive normal browsing gaps without re-prompting the user.
const MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

export type ActiveLocation = {
  savedLocationId: number | null;
  name: string;
  latitude: number;
  longitude: number;
};

function isActiveLocation(value: unknown): value is ActiveLocation {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    (candidate.savedLocationId === null || typeof candidate.savedLocationId === "number") &&
    typeof candidate.name === "string" &&
    typeof candidate.latitude === "number" &&
    typeof candidate.longitude === "number"
  );
}

/**
 * Not HttpOnly - it carries no secret, and read-only client access is a
 * reasonable escape hatch for future UI, unlike the auth cookies in
 * session.ts which must never reach client JS.
 */
export async function setActiveLocation(location: ActiveLocation) {
  const store = await cookies();
  store.set(ACTIVE_LOCATION_COOKIE, JSON.stringify(location), {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function getActiveLocation(): Promise<ActiveLocation | null> {
  const store = await cookies();
  const raw = store.get(ACTIVE_LOCATION_COOKIE)?.value;
  if (!raw) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    return isActiveLocation(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
