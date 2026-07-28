import type { Locale } from "@weather-app/contract";

/**
 * Interface strings that are not about the weather itself - empty states,
 * failures, navigation labels.
 *
 * Separate from weatherMessages because the two have different lifetimes: the
 * weather vocabulary is fixed by the WMO code list, while this grows with every
 * screen. Same rule as the rest of the catalogue (follow-up.md point 8): no
 * Polish in JSX, and IMGW's own warning text is never translated.
 */
export type AppMessages = {
  forecastUnavailable: string;
  retry: string;
  loading: string;
  savedPlaces: string;
  /** Header for the page showing where the phone is. */
  myLocation: string;
  language: string;
  /** Endonyms: a language is listed in itself, or the person who needs it cannot read it. */
  languageNames: Record<Locale, string>;
  searchPlaceholder: string;
  noSavedPlaces: string;
  noSearchResults: string;
  cancel: string;
  signInToSave: string;
  remove: string;
  alreadySaved: string;
  saveFailed: string;
  sessionExpired: string;
  back: string;
  settings: string;
  units: string;
  temperature: string;
  windSpeed: string;
  precipitationUnit: string;
  saveFailedGeneric: string;
};

/**
 * Unit choices, labelled by the symbol people actually read on the screen.
 *
 * Not translated - "°C" is "°C" in both languages, and inventing a Polish
 * spelling of "mph" would be worse than leaving it.
 */
export const unitLabels = {
  temperatureUnit: { CELSIUS: "°C", FAHRENHEIT: "°F" },
  windSpeedUnit: { KMH: "km/h", MPH: "mph" },
  precipitationUnit: { MM: "mm", IN: "in" },
} as const;

export const appMessages: Record<Locale, AppMessages> = {
  pl: {
    forecastUnavailable: "Nie udało się pobrać prognozy",
    retry: "Spróbuj ponownie",
    loading: "Ładowanie",
    savedPlaces: "Twoje miejsca",
    myLocation: "Moja lokalizacja",
    language: "Język",
    languageNames: { pl: "Polski", en: "English" },
    searchPlaceholder: "Szukaj miejscowości",
    noSearchResults: "Brak wyników",
    cancel: "Anuluj",
    noSavedPlaces: "Nie masz jeszcze zapisanych miejsc. Wyszukaj miejscowość powyżej.",
    signInToSave: "Zaloguj się, aby zapisywać miejsca i dostawać ostrzeżenia.",
    remove: "Usuń",
    alreadySaved: "Ta lokalizacja jest już zapisana.",
    saveFailed: "Nie udało się zapisać lokalizacji.",
    sessionExpired: "Sesja wygasła. Zaloguj się ponownie.",
    back: "Wróć",
    settings: "Ustawienia",
    units: "Jednostki",
    temperature: "Temperatura",
    windSpeed: "Prędkość wiatru",
    precipitationUnit: "Opad",
    saveFailedGeneric: "Nie udało się zapisać zmiany.",
  },
  en: {
    forecastUnavailable: "Could not load the forecast",
    retry: "Try again",
    loading: "Loading",
    savedPlaces: "Your places",
    myLocation: "My location",
    language: "Language",
    languageNames: { pl: "Polski", en: "English" },
    searchPlaceholder: "Search for a town",
    noSearchResults: "No results",
    cancel: "Cancel",
    noSavedPlaces: "No saved places yet. Search for a town above.",
    signInToSave: "Sign in to save places and receive warnings.",
    remove: "Remove",
    alreadySaved: "That location is already saved.",
    saveFailed: "Could not save the location.",
    sessionExpired: "Your session expired. Please sign in again.",
    back: "Back",
    settings: "Settings",
    units: "Units",
    temperature: "Temperature",
    windSpeed: "Wind speed",
    precipitationUnit: "Precipitation",
    saveFailedGeneric: "Could not save that change.",
  },
};
