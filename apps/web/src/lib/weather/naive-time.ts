/**
 * The backend's forecast timestamps are naive local time - Open-Meteo is
 * queried with timezone=auto, so `"2026-07-25T00:15:00"` means 00:15 in the
 * displayed location, with no UTC offset attached. `new Date(thatString)`
 * would parse it as local time *of whatever machine runs this code*, which
 * is correct only by coincidence when the server's TZ happens to also be
 * Europe/Warsaw. Comparing and reading these as plain strings (ISO order
 * sorts chronologically) sidesteps the whole problem instead of trying to
 * out-clever Date's parsing rules.
 */

/** "2026-07-25T00:15:00" -> 0 */
export function hourOf(naiveIsoTimestamp: string): number {
  return Number(naiveIsoTimestamp.slice(11, 13));
}

/** "2026-07-25T00:15:00" -> "00:15" */
export function formatHourMinute(naiveIsoTimestamp: string): string {
  return naiveIsoTimestamp.slice(11, 16);
}

/** Same naive-local-time shape as the backend emits, for the given zone -
 * so it can be compared to backend timestamps with plain string comparison. */
export function nowAsNaiveIsoTimestamp(now: Date, timeZone = "Europe/Warsaw"): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "00";

  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}`;
}
