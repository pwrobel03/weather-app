import { describe, expect, it } from "vitest";

import { formatHourMinute, hourOf, nowAsNaiveIsoTimestamp, weekdayName } from "./naive-time";

/**
 * These functions exist entirely to avoid Date's parsing rules, so the tests
 * are about the trap rather than about formatting.
 */
describe("naive local time", () => {
  it("reads the hour written in the string, not the machine's hour", () => {
    // The backend queries Open-Meteo with timezone=auto: this is 14:00 at the
    // forecast location, with no offset attached. Whatever TZ the test runner
    // is in, the answer is 14.
    expect(hourOf("2026-07-27T14:00:00")).toBe(14);
    expect(formatHourMinute("2026-07-27T14:35:00")).toBe("14:35");
  });

  it("keeps a date-only string on its own calendar day", () => {
    // Bare YYYY-MM-DD is the one case the spec parses as UTC midnight. Anchor
    // both parse and format to UTC or the weekday shifts by one west of
    // Greenwich.
    expect(weekdayName("2026-07-27", "en-GB")).toBe("Mon");
    expect(weekdayName("2026-01-01", "en-GB")).toBe("Thu");
  });

  it("emits a timestamp shaped so it can be string-compared to the backend's", () => {
    const now = new Date("2026-07-27T12:00:00Z");
    const warsaw = nowAsNaiveIsoTimestamp(now, "Europe/Warsaw");

    expect(warsaw).toBe("2026-07-27T14:00:00");
    // ISO order sorts chronologically, which is what the hourly strip relies on
    // instead of parsing every entry.
    expect("2026-07-27T15:00:00" >= warsaw).toBe(true);
    expect("2026-07-27T13:00:00" >= warsaw).toBe(false);
  });
});
