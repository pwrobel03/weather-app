import type { Locale } from "@weather-app/contract";

/**
 * Labels around a warning, as distinct from `alertMessages`, which carries the
 * warning's own vocabulary (severity, validity, source attribution).
 *
 * apps/web still declares Polish/English equivalents of several of these
 * inline in its alert components. They belong here and should follow, but
 * moving them touches files that were hand-tuned during the redesign, so it is
 * a separate change rather than a drive-by.
 */
export type AlertUiMessages = {
  warning: string;
  warnings: string;
  /**
   * The timeline of a place's warnings, which keeps expired ones.
   *
   * Distinct from `warnings` on purpose: labelling both the home tile (in
   * force now) and this list (everything ever recorded) "Warnings" reads as
   * one screen contradicting the other when a warning has just expired.
   */
  warningHistory: string;
  map: string;
  from: string;
  expired: string;
  probability: string;
  noActiveWarnings: string;
  signInToSeeWarnings: string;
  /** States plainly that IMGW's text is passed through untouched. */
  disclaimer: string;
  notFound: string;
};

export const alertUiMessages: Record<Locale, AlertUiMessages> = {
  pl: {
    warning: "Ostrzeżenie",
    warnings: "Ostrzeżenia",
    warningHistory: "Historia ostrzeżeń",
    map: "Mapa",
    from: "Od",
    expired: "Zakończone",
    probability: "Prawdopodobieństwo",
    noActiveWarnings: "Brak aktywnych ostrzeżeń dla Twoich miejsc.",
    signInToSeeWarnings: "Zaloguj się, żeby widzieć ostrzeżenia dla swoich miejsc.",
    disclaimer:
      "Treść pochodzi bezpośrednio z IMGW i nie jest przez nas modyfikowana ani tłumaczona.",
    notFound: "Nie znaleziono tego ostrzeżenia.",
  },
  en: {
    warning: "Warning",
    warnings: "Warnings",
    warningHistory: "Warning history",
    map: "Map",
    from: "From",
    expired: "Expired",
    probability: "Probability",
    noActiveWarnings: "No warnings in force for your places.",
    signInToSeeWarnings: "Sign in to see warnings for your places.",
    disclaimer: "The text comes directly from IMGW and is neither edited nor translated by us.",
    notFound: "That warning could not be found.",
  },
};
