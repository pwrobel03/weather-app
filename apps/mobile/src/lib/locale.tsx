import AsyncStorage from "@react-native-async-storage/async-storage";
import { type Locale } from "@weather-app/core";
import { createContext, useCallback, useContext, useEffect, useState } from "react";

import { deviceLocale, resolveLocale } from "./preferences";

const KEY = "wx_locale";

type LocaleValue = {
  locale: Locale;
  /** False until the stored choice has been read back off the device. */
  ready: boolean;
  choose: (locale: Locale) => Promise<void>;
};

const LocaleContext = createContext<LocaleValue | null>(null);

export function useLocale(): LocaleValue {
  const value = useContext(LocaleContext);
  if (!value) throw new Error("useLocale must be used inside <LocaleProvider>");
  return value;
}

/**
 * The language the interface speaks.
 *
 * Three sources, most deliberate first: a stored choice, then the device's own
 * language, then Polish. The middle one matters more than it looks - most
 * people never open a language setting, so the default has to be right without
 * being chosen.
 *
 * AsyncStorage rather than SecureStore: a language is a preference, not a
 * secret, and the Keychain is a small, slow store meant for credentials.
 *
 * Note on what this does *not* cover: push notification text is composed on the
 * server and the push token carries no locale yet (follow-up.md point 12 decided
 * it should). Until that lands, changing the language here changes the app and
 * not the notifications - stated rather than quietly true.
 */
export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>(deviceLocale);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void AsyncStorage.getItem(KEY)
      .then((stored) => {
        if (!cancelled) setLocale((current) => resolveLocale(stored, current));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const choose = useCallback(async (next: Locale) => {
    setLocale(next);
    await AsyncStorage.setItem(KEY, next);
  }, []);

  return (
    <LocaleContext.Provider value={{ locale, ready, choose }}>{children}</LocaleContext.Provider>
  );
}
