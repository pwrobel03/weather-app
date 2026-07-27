/**
 * Interim message catalogue for the alert layer.
 *
 * The i18n model is already decided (markdown/follow-up.md point 8): enums
 * travel in the contract, translation happens client-side. next-intl arrives
 * in Faza 10 and will own the loading, formatting and locale negotiation -
 * this module exists so the first user-facing screen is not written with
 * Polish baked into JSX, which would then have to be excavated.
 *
 * Structured as flat per-locale records so migrating is a move, not a rewrite.
 *
 * Deliberately absent: any translation of IMGW's free warning text. That stays
 * Polish and is labelled with its source, per the same decision - machine
 * translating a safety message is a risk nobody asked us to take.
 */

import { LocaleSchema } from "@weather-app/contract";

import type { ConditionKey } from "../weather/condition";

/**
 * The locale list is the contract's, not ours. It used to be declared here as
 * well, which meant adding a language needed two edits and silently half-worked
 * if you made one.
 */
export const LOCALES = LocaleSchema.options;

export type { Locale } from "@weather-app/contract";
export { DEFAULT_LOCALE } from "@weather-app/contract";

type Locale = (typeof LOCALES)[number];

export type AlertMessages = {
  /** Indexed by IMGW severity level, matching WarningSeveritySchema. */
  severityLabel: Record<"1" | "2" | "3", string>;
  inForceUntil: string;
  affects: string;
  source: string;
  /** Marks IMGW's free text as untranslated, so an English reader knows why. */
  originalLanguageNote: string;
};

export const alertMessages: Record<Locale, AlertMessages> = {
  pl: {
    severityLabel: {
      "1": "Ostrzeżenie 1. stopnia",
      "2": "Ostrzeżenie 2. stopnia",
      "3": "Ostrzeżenie 3. stopnia",
    },
    inForceUntil: "Obowiązuje do",
    affects: "Dotyczy",
    source: "Źródło: IMGW",
    originalLanguageNote: "Treść ostrzeżenia w oryginale",
  },
  en: {
    severityLabel: {
      "1": "Level 1 warning",
      "2": "Level 2 warning",
      "3": "Level 3 warning",
    },
    inForceUntil: "In force until",
    affects: "Affects",
    source: "Source: IMGW",
    originalLanguageNote: "Warning text in the original Polish",
  },
};

/** BCP 47 tags for Intl formatting. */
const INTL_LOCALE: Record<Locale, string> = {
  pl: "pl-PL",
  en: "en-GB",
};

export function formatValidity(value: string, locale: Locale, timeZone = "Europe/Warsaw"): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(new Date(value));
}

export function listFormat(items: readonly string[], locale: Locale): string {
  return new Intl.ListFormat(INTL_LOCALE[locale], {
    style: "long",
    type: "conjunction",
  }).format(items);
}

/** Phrase under the temperature, plus the metric strip labels (design.md §6). */
export type WeatherMessages = {
  condition: Record<ConditionKey, string>;
  wind: string;
  humidity: string;
  precipitation: string;
  feelsLike: string;
  sevenDays: string;
  today: string;
};

export const weatherMessages: Record<Locale, WeatherMessages> = {
  pl: {
    condition: {
      clear: "Bezchmurnie",
      mainlyClear: "Przeważnie bezchmurnie",
      partlyCloudy: "Częściowe zachmurzenie",
      overcast: "Zachmurzenie całkowite",
      fog: "Mgła",
      drizzle: "Mżawka",
      rain: "Deszcz",
      heavyRain: "Silny deszcz",
      showers: "Przelotny deszcz",
      snow: "Śnieg",
      heavySnow: "Intensywny śnieg",
      thunderstorm: "Burza",
      thunderstormHail: "Burza z gradem",
    },
    wind: "Wiatr",
    humidity: "Wilgotność",
    precipitation: "Opad",
    feelsLike: "Odczuwalna",
    sevenDays: "7 dni",
    today: "Dzisiaj",
  },
  en: {
    condition: {
      clear: "Clear",
      mainlyClear: "Mainly clear",
      partlyCloudy: "Partly cloudy",
      overcast: "Overcast",
      fog: "Fog",
      drizzle: "Drizzle",
      rain: "Rain",
      heavyRain: "Heavy rain",
      showers: "Showers",
      snow: "Snow",
      heavySnow: "Heavy snow",
      thunderstorm: "Thunderstorm",
      thunderstormHail: "Thunderstorm with hail",
    },
    wind: "Wind",
    humidity: "Humidity",
    precipitation: "Precipitation",
    feelsLike: "Feels like",
    sevenDays: "7 days",
    today: "Today",
  },
};

/** Weekday plus day and month, as under the temperature in major.png. */
export function formatHeroDate(value: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(value);
}
