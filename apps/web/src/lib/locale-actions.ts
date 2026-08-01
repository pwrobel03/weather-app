"use server";

import type { Locale } from "@weather-app/core";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { LOCALE_COOKIE } from "./locale";

/**
 * Stores the chosen language and re-renders the app in it.
 *
 * `revalidatePath("/", "layout")` rather than a reload: every string on this
 * site is server-rendered, so the language is a property of the render and not
 * of anything the client holds. The same shape as the active-location action,
 * for the same reason.
 *
 * A year, and not http-only. A language is not a secret, and the client reads
 * it too - the offline banner has to know what to say when the server is not
 * reachable to say it.
 */
export async function setLocaleAction(locale: Locale): Promise<void> {
  (await cookies()).set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  revalidatePath("/", "layout");
}
