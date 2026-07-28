import { describe, expect, it } from "vitest";

import {
  formatHourMinute,
  hourOf,
  localHourFromForecast,
  nowAsNaiveIsoTimestamp,
  weekdayName,
} from "./naive-time";

/** A day of hourly entries as the backend returns it: from midnight onwards. */
const wholeDay = Array.from({ length: 24 }, (_, hour) => ({
  time: `2026-07-27T${String(hour).padStart(2, "0")}:00:00`,
}));

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

describe("the hour at the displayed location", () => {
  it("skips the hours of the day that have already passed", () => {
    // 09:23 Warsaw. The entry list still starts at midnight, and taking that
    // first entry is what used to put a moon over a sunny morning.
    const now = new Date("2026-07-27T07:23:00Z");

    expect(localHourFromForecast(wholeDay, now)).toBe(10);
  });

  it("agrees with the hour the strip accents", () => {
    const now = new Date("2026-07-27T07:23:00Z");
    const nowLocal = nowAsNaiveIsoTimestamp(now);
    const leadingChip = wholeDay.find((entry) => entry.time >= nowLocal);

    expect(leadingChip).toBeDefined();
    expect(localHourFromForecast(wholeDay, now)).toBe(hourOf(leadingChip!.time));
  });

  it("reads midnight as midnight when midnight is what it is", () => {
    expect(localHourFromForecast(wholeDay, new Date("2026-07-26T22:00:00Z"))).toBe(0);
  });

  it("falls back to the local clock, not UTC, once the forecast runs out", () => {
    // Empty list, and a moment where UTC and Warsaw straddle midnight: UTC says
    // 23, the location says 1. Answering 23 would paint the wrong sky.
    expect(localHourFromForecast([], new Date("2026-07-27T23:00:00Z"))).toBe(1);
  });
});
