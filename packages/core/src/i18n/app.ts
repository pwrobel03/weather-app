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
};

export const appMessages: Record<Locale, AppMessages> = {
  pl: {
    forecastUnavailable: "Nie udało się pobrać prognozy",
    retry: "Spróbuj ponownie",
    loading: "Ładowanie",
  },
  en: {
    forecastUnavailable: "Could not load the forecast",
    retry: "Try again",
    loading: "Loading",
  },
};
