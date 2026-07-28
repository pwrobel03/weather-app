import AsyncStorage from "@react-native-async-storage/async-storage";
import { DEFAULT_LOCALE, type Locale } from "@weather-app/core";
import { createContext, useCallback, useContext, useEffect, useState } from "react";

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
        if (!cancelled && isLocale(stored)) setLocale(stored);
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

/**
 * The device's language, read from Intl rather than from expo-localization.
 *
 * A native module would be the textbook answer, but all that is needed here is
 * a coarse language tag, and `Intl.DateTimeFormat` is already load-bearing in
 * this app (dates and the naive-time helpers), so it is known to work on this
 * runtime. Not adding a native module also means not adding a rebuild to every
 * checkout of this branch.
 */
function deviceLocale(): Locale {
  try {
    const tag = new Intl.DateTimeFormat().resolvedOptions().locale;
    return tag.toLowerCase().startsWith("pl") ? "pl" : "en";
  } catch {
    return DEFAULT_LOCALE;
  }
}

function isLocale(value: string | null): value is Locale {
  return value === "pl" || value === "en";
}
