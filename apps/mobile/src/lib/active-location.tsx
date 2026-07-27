import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type ActiveLocation = {
  savedLocationId: number | null;
  name: string;
  latitude: number;
  longitude: number;
};

/** Warszawa - the fallback until a location is chosen or saved. */
export const DEFAULT_LOCATION: ActiveLocation = {
  savedLocationId: null,
  name: "Warszawa",
  latitude: 52.2297,
  longitude: 21.0122,
};

const KEY = "wx_active_location";

type ActiveLocationValue = {
  active: ActiveLocation;
  /** False until the stored choice has been read back off the device. */
  ready: boolean;
  choose: (location: ActiveLocation) => Promise<void>;
};

const ActiveLocationContext = createContext<ActiveLocationValue | null>(null);

export function useActiveLocation(): ActiveLocationValue {
  const value = useContext(ActiveLocationContext);
  if (!value) throw new Error("useActiveLocation must be used inside <ActiveLocationProvider>");
  return value;
}

/**
 * Which place the home screen shows, remembered across launches.
 *
 * A provider rather than a plain hook, and that is the whole point: the home
 * screen and the locations screen are mounted at the same time in the stack.
 * With per-hook state, picking a place on the locations screen would write to
 * storage and update only that screen - going back would show the previous
 * location until the app was restarted.
 *
 * AsyncStorage rather than SecureStore: this is a preference, not a secret,
 * and the Keychain is a small, slow store meant for credentials. apps/web
 * keeps the same value in a plain cookie for the same reason.
 *
 * The whole location is stored, not just its id. An id alone would leave the
 * first frame after launch with no coordinates to fetch, so the screen would
 * open empty until the saved-locations request came back - and would fall
 * back to Warszawa for anyone offline.
 */
export function ActiveLocationProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState<ActiveLocation>(DEFAULT_LOCATION);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (cancelled || !raw) return;
        setActive(JSON.parse(raw) as ActiveLocation);
      })
      .catch(() => {
        // A corrupt or unreadable entry is not worth surfacing - the default
        // location is a perfectly good answer.
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const choose = useCallback(async (location: ActiveLocation) => {
    setActive(location);
    await AsyncStorage.setItem(KEY, JSON.stringify(location));
  }, []);

  const value = useMemo(() => ({ active, ready, choose }), [active, ready, choose]);

  return <ActiveLocationContext.Provider value={value}>{children}</ActiveLocationContext.Provider>;
}
