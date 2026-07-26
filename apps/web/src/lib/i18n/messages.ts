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

export const LOCALES = ["pl", "en"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "pl";

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
