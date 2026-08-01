import { z } from "zod";

/**
 * Supported UI locales. Extend this list to add a language — nothing else in
 * the contract needs to change, since translatable content lives in
 * client-side i18n resources (next-intl / i18next), not in these schemas.
 */
export const LocaleSchema = z.enum(["pl", "en"]);

export type Locale = z.infer<typeof LocaleSchema>;

export const DEFAULT_LOCALE: Locale = "pl";
