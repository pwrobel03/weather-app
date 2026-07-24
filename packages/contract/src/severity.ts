import { z } from "zod";

/**
 * IMGW's official 3-level warning scale (yellow / orange / red), matching the
 * `stopien` field returned by https://danepubliczne.imgw.pl/api/data/warningsmeteo.
 * Kept as the raw string values from the source rather than transformed to a
 * number, so a schema mismatch against the live API surfaces immediately.
 *
 * The label for each level (and its color) is a client-side i18n concern, not
 * part of this schema — see the "enum + client-side translation" decision in
 * markdown/follow-up.md.
 */
export const WarningSeveritySchema = z.enum(["1", "2", "3"]);

export type WarningSeverity = z.infer<typeof WarningSeveritySchema>;
