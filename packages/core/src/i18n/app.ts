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
  searchPlaceholder: string;
  noSavedPlaces: string;
  signInToSave: string;
  remove: string;
  alreadySaved: string;
  saveFailed: string;
  sessionExpired: string;
  back: string;
};

export const appMessages: Record<Locale, AppMessages> = {
  pl: {
    forecastUnavailable: "Nie udało się pobrać prognozy",
    retry: "Spróbuj ponownie",
    loading: "Ładowanie",
    savedPlaces: "Twoje miejsca",
    searchPlaceholder: "Szukaj miejscowości",
    noSavedPlaces: "Nie masz jeszcze zapisanych miejsc. Wyszukaj miejscowość powyżej.",
    signInToSave: "Zaloguj się, aby zapisywać miejsca i dostawać ostrzeżenia.",
    remove: "Usuń",
    alreadySaved: "Ta lokalizacja jest już zapisana.",
    saveFailed: "Nie udało się zapisać lokalizacji.",
    sessionExpired: "Sesja wygasła. Zaloguj się ponownie.",
    back: "Wróć",
  },
  en: {
    forecastUnavailable: "Could not load the forecast",
    retry: "Try again",
    loading: "Loading",
    savedPlaces: "Your places",
    searchPlaceholder: "Search for a town",
    noSavedPlaces: "No saved places yet. Search for a town above.",
    signInToSave: "Sign in to save places and receive warnings.",
    remove: "Remove",
    alreadySaved: "That location is already saved.",
    saveFailed: "Could not save the location.",
    sessionExpired: "Your session expired. Please sign in again.",
    back: "Back",
  },
};
