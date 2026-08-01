import * as Location from "expo-location";
import { useEffect, useState } from "react";

import type { ActiveLocation } from "./active-location";

/**
 * Where the phone is, as a place the home screen can show.
 *
 * Foreground permission only. The app needs a position when someone opens it
 * to see the weather where they are - it never needs one while closed, because
 * warnings arrive by push and are matched server-side against the places the
 * user chose. Asking for "always" would buy nothing and cost a permission
 * people decline outright.
 *
 * `savedLocationId` is null, like the Warszawa default: this is a place to
 * look at, not one the account owns.
 */
export type DeviceLocationState =
  /** Still deciding - permission dialog, or the first fix. */
  | { status: "pending" }
  /** Settled: either a position, or a reason there is none. */
  | { status: "ready"; location: ActiveLocation | null };

export function useDeviceLocation(name: string): DeviceLocationState {
  const [state, setState] = useState<DeviceLocationState>({ status: "pending" });

  useEffect(() => {
    let cancelled = false;
    const settle = (location: ActiveLocation | null) => {
      if (!cancelled) setState({ status: "ready", location });
    };

    void (async () => {
      try {
        const { granted } = await Location.requestForegroundPermissionsAsync();
        // A refusal is an answer, not a failure: the pager simply starts at
        // the saved places, and nothing asks again on this launch.
        if (!granted) return settle(null);

        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const { latitude, longitude } = position.coords;

        settle({
          savedLocationId: null,
          name: (await placeName(latitude, longitude)) ?? name,
          latitude,
          longitude,
        });
      } catch {
        // No fix indoors, location services off, a timeout - all the same
        // outcome here, and none of them is worth an error message on the one
        // screen someone opened to check the weather.
        settle(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [name]);

  return state;
}

/**
 * "Rzeszów" rather than "50.04, 22.00".
 *
 * Best-effort by design: reverse geocoding is a separate permission-free
 * lookup that can fail on its own, and a header reading the fallback label is
 * a far smaller problem than a page that refuses to appear.
 */
async function placeName(latitude: number, longitude: number): Promise<string | null> {
  try {
    const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });
    return place?.city ?? place?.subregion ?? place?.region ?? null;
  } catch {
    return null;
  }
}
