import AsyncStorage from "@react-native-async-storage/async-storage";
import { colorScheme } from "nativewind";
import { createContext, useCallback, useContext, useEffect, useState } from "react";

import { isThemeChoice, type ThemeChoice } from "./preferences";

const KEY = "wx_theme";

// Re-exported so the settings screen keeps importing its theme type from the
// provider it uses, rather than reaching past it.
export type { ThemeChoice };

type ThemeValue = {
  theme: ThemeChoice;
  choose: (theme: ThemeChoice) => Promise<void>;
};

const ThemeContext = createContext<ThemeValue | null>(null);

export function useTheme(): ThemeValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used inside <ThemeProvider>");
  return value;
}

/**
 * Which theme the surfaces outside the hero use.
 *
 * The hero is not part of this. Its colour is composed from the weather
 * channels and *is* the information the screen carries (decision 16), so it
 * stays as it is whether the rest of the app is light or dark - the same way
 * the platform's own weather app keeps its sky whatever the system theme says.
 *
 * The choice is handed to NativeWind rather than threaded through components:
 * the palette lives in CSS variables behind a `prefers-color-scheme` query, so
 * setting the scheme re-resolves every class at once and no component needs to
 * know a theme exists.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<ThemeChoice>("system");

  useEffect(() => {
    let cancelled = false;

    void AsyncStorage.getItem(KEY)
      .then((stored) => {
        if (cancelled || !isThemeChoice(stored)) return;
        setTheme(stored);
        colorScheme.set(stored);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  const choose = useCallback(async (next: ThemeChoice) => {
    setTheme(next);
    colorScheme.set(next);
    await AsyncStorage.setItem(KEY, next);
  }, []);

  return <ThemeContext.Provider value={{ theme, choose }}>{children}</ThemeContext.Provider>;
}
