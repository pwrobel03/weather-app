import { DEFAULT_LOCALE, type Locale } from "@weather-app/core";

/**
 * What a stored preference means, for the two settings that change every
 * screen at once.
 *
 * Split out from `locale.tsx` and `theme.tsx` for one reason: those files
 * import AsyncStorage and NativeWind, which ship untranspiled Flow and cannot
 * be loaded by the Node test suite. The providers are wiring; the decisions
 * are here, and here they can be tested.
 */

/** "system" is a real choice, not the absence of one - it tracks the phone. */
export type ThemeChoice = "system" | "light" | "dark";

/**
 * Which of the three language sources wins.
 *
 * `fallback` is what the caller already resolved from the device, so a missing
 * or unrecognised stored value leaves the language where it was rather than
 * jolting it to Polish.
 */
export function resolveLocale(stored: string | null, fallback: Locale): Locale {
  return isLocale(stored) ? stored : fallback;
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
export function deviceLocale(): Locale {
  try {
    return localeFromTag(new Intl.DateTimeFormat().resolvedOptions().locale);
  } catch {
    return DEFAULT_LOCALE;
  }
}

/**
 * Polish for a Polish tag, English for everything else.
 *
 * Not a lookup of the two supported languages: someone whose phone is in German
 * is better served by English than by a language they are even less likely to
 * read. The Intl failure path above is the one case that lands on Polish, and
 * only because it means nothing at all is known about the device.
 */
export function localeFromTag(tag: string): Locale {
  return tag.toLowerCase().startsWith("pl") ? "pl" : "en";
}

/**
 * Whether what came back off the device is a theme this app knows.
 *
 * The only thing standing between the storage layer and `colorScheme.set`,
 * which takes whatever it is handed. A key left by an older build, or one
 * edited by hand, has to stop here rather than become a scheme no stylesheet
 * resolves against.
 */
export function isThemeChoice(value: string | null): value is ThemeChoice {
  return value === "system" || value === "light" || value === "dark";
}

function isLocale(value: string | null): value is Locale {
  return value === "pl" || value === "en";
}
