import "server-only";

import { DEFAULT_LOCALE, type Locale } from "@weather-app/core";
import { cookies } from "next/headers";

/** Read by the client too, so it is not http-only - a language is not a secret. */
export const LOCALE_COOKIE = "wx_locale";

/**
 * The language this request should be answered in.
 *
 * A cookie rather than a path segment or the Accept-Language header. The
 * header is a browser-wide setting and gets overridden by a deliberate choice;
 * a path segment would move every route in the app, which is a change worth
 * making once - when there is a language switcher to justify it - and not as a
 * side effect of moving four error strings.
 *
 * Reading it here rather than in each caller is what unblocks Server Actions:
 * an action has no props to be handed a locale through, and the request is the
 * only thing it and the page have in common.
 */
export async function getRequestLocale(): Promise<Locale> {
  const stored = (await cookies()).get(LOCALE_COOKIE)?.value;

  return stored === "en" || stored === "pl" ? stored : DEFAULT_LOCALE;
}
