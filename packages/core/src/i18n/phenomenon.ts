import type { Locale } from "@weather-app/contract";

/**
 * IMGW's phenomenon names, in English.
 *
 * The severity level is an enum and travels as one. The phenomenon does not:
 * `nazwaZdarzenia` is free text on IMGW's side, and the backend passes it
 * through unchanged (AlertMapper). So this is a lookup over the names IMGW
 * actually issues rather than a translation of a closed set - which is why it
 * has to fall back rather than throw.
 *
 * Client-side by decision (follow-up.md point 8). Translating on the server
 * would mean the same warning stored twice and a re-ingest to fix a wording
 * mistake; here a correction ships with the app.
 *
 * What is deliberately *not* here is IMGW's `tresc` - the paragraph describing
 * what to expect. That stays Polish and is marked as such, because a machine
 * translation of a safety instruction is a liability, not a feature.
 */
const ENGLISH: Record<string, string> = {
  "burze": "Thunderstorms",
  "burze z gradem": "Thunderstorms with hail",
  "silny wiatr": "Strong wind",
  "wiatr": "Wind",
  "intensywne opady deszczu": "Heavy rain",
  "opady deszczu": "Rain",
  "intensywne opady śniegu": "Heavy snow",
  "opady śniegu": "Snow",
  "opady marznące": "Freezing rain",
  "oblodzenie": "Ice",
  "przymrozki": "Ground frost",
  "silny mróz": "Severe frost",
  "upał": "Heat",
  "gęsta mgła": "Dense fog",
  "zawieje i zamiecie śnieżne": "Blowing and drifting snow",
  "zamiecie śnieżne": "Drifting snow",
  "roztopy": "Thaw",
  "śliskość pośniegowa": "Slippery conditions after snow",
  "silny deszcz z burzami": "Heavy rain with thunderstorms",
};

/**
 * The phenomenon as the reader's language has it, or as IMGW wrote it.
 *
 * The fallback is the Polish original rather than a placeholder. A warning
 * headed "Unknown phenomenon" is worse than one headed in a language the
 * reader may still recognise - and IMGW adding a name is a normal event, not
 * an error condition.
 */
export function phenomenonName(event: string, locale: Locale): string {
  if (locale === "pl") return event;

  return ENGLISH[normalise(event)] ?? event;
}

/**
 * Whether the name shown is the original rather than a translation.
 *
 * Lets a screen say so, which is the same promise made about the free text:
 * an English reader is told when they are looking at Polish, instead of being
 * left to work it out.
 */
export function isPhenomenonTranslated(event: string, locale: Locale): boolean {
  return locale === "pl" || normalise(event) in ENGLISH;
}

/**
 * IMGW is not consistent about case, spacing or the slash in
 * "zawieje/zamiecie", so the key is normalised rather than matched literally.
 */
function normalise(event: string): string {
  return event.toLowerCase().replace(/\s*\/\s*/g, " i ").replace(/\s+/g, " ").trim();
}
