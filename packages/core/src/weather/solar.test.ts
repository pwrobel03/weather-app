import { describe, expect, it } from "vitest";

import { eventMinutesUtc, solarNoonMinutesUtc, solarTimes } from "./solar";

/**
 * Checked against the US Naval Observatory's published tables, not against
 * this implementation's own output.
 *
 * That distinction is the whole value of the file. A test written from what
 * the code returns passes by construction and would have sailed past a sign
 * error in the equation of time - which is worth up to sixteen minutes, twice
 * a year, in opposite directions.
 *
 * Assertions are in UTC wherever the sun itself is being tested. A local-time
 * failure cannot say whether the sun or the timezone offset was wrong, and
 * they are separate questions with separate bugs.
 *
 * Source: aa.usno.navy.mil/calculated/rstt/oneday, queried 2026-08-01 for
 * 52.2297N 21.0122E (Warszawa). Tolerance is two minutes, which is wider than
 * the disagreement found (zero) and narrower than any error that would matter
 * on screen.
 */
const WARSAW = { latitude: 52.2297, longitude: 21.0122 };
const TOLERANCE_MINUTES = 2;

/** Noon rather than midnight, so the date is unambiguous in either hemisphere's offset. */
const noonUtc = (date: string) => new Date(`${date}T12:00:00Z`);

const hhmm = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(Math.round(minutes % 60)).padStart(2, "0")}`;

function expectMinutes(actual: number | null, expected: string) {
  expect(actual).not.toBeNull();

  const [hours, minutes] = expected.split(":").map(Number) as [number, number];
  const target = hours * 60 + minutes;

  // Reported as a clock time on failure. "expected 883 to be close to 1021" is
  // a number nobody can check against a table.
  expect(hhmm(actual!), `${hhmm(actual!)} vs ${expected}`).toBeTruthy();
  expect(Math.abs(actual! - target)).toBeLessThanOrEqual(TOLERANCE_MINUTES);
}

describe("sunrise and sunset against USNO", () => {
  it("matches the summer solstice", () => {
    const date = noonUtc("2026-06-21");

    expectMinutes(eventMinutesUtc(date, WARSAW.latitude, WARSAW.longitude, 90.833, "rise"), "02:14");
    expectMinutes(eventMinutesUtc(date, WARSAW.latitude, WARSAW.longitude, 90.833, "set"), "19:01");
    expectMinutes(solarNoonMinutesUtc(date, WARSAW.longitude), "10:38");
  });

  it("matches the winter solstice", () => {
    // The other end of the swing this module exists for: seven hours less
    // daylight, and the sun crossing south four minutes earlier by the clock.
    const date = noonUtc("2026-12-21");

    expectMinutes(eventMinutesUtc(date, WARSAW.latitude, WARSAW.longitude, 90.833, "rise"), "06:43");
    expectMinutes(eventMinutesUtc(date, WARSAW.latitude, WARSAW.longitude, 90.833, "set"), "14:25");
    expectMinutes(solarNoonMinutesUtc(date, WARSAW.longitude), "10:34");
  });

  it("matches civil twilight, which is what the dawn and dusk anchors ride on", () => {
    const date = noonUtc("2026-12-21");

    expectMinutes(eventMinutesUtc(date, WARSAW.latitude, WARSAW.longitude, 96, "rise"), "06:02");
    expectMinutes(eventMinutesUtc(date, WARSAW.latitude, WARSAW.longitude, 96, "set"), "15:06");
  });
});

describe("the equation of time, which is the part most easily wrong by a sign", () => {
  it("puts solar noon later in February than in November", () => {
    // A sundial runs about fourteen minutes behind the clock in mid-February
    // and sixteen ahead in early November. Getting the sign backwards moves
    // solar noon half an hour the wrong way and still looks like a plausible
    // time of day, which is why this is asserted as a comparison rather than
    // trusted to the anchors above.
    const february = solarNoonMinutesUtc(noonUtc("2026-02-11"), WARSAW.longitude);
    const november = solarNoonMinutesUtc(noonUtc("2026-11-03"), WARSAW.longitude);

    expect(february).toBeGreaterThan(november);
    expect(february - november).toBeGreaterThan(25);
  });
});

describe("polar latitudes, which Poland never sees and the type does not know that", () => {
  it("reports no sunrise and no sunset during a polar day", () => {
    // Svalbard in June. Null rather than a clamped number: a caller handed a
    // sunrise at solar noon would paint a sky nobody could explain.
    const times = solarTimes(noonUtc("2026-06-21"), 78.2, 15.6, "UTC");

    expect(times.sunrise).toBeNull();
    expect(times.sunset).toBeNull();
  });

  it("still has a solar noon during a polar night", () => {
    // The sun has a highest point even when that point is below the horizon,
    // so this one is never null - and a caller blending towards "day" needs it.
    const times = solarTimes(noonUtc("2026-12-21"), 78.2, 15.6, "UTC");

    expect(times.sunrise).toBeNull();
    expect(times.solarNoon).toBeGreaterThan(0);
    expect(times.solarNoon).toBeLessThan(24);
  });
});

describe("local times, which is the offset's job rather than the sun's", () => {
  it("follows summer time and winter time across the same year", () => {
    // Warsaw is UTC+2 in June and UTC+1 in December. The same UTC sunrise has
    // to come back as two different local hours, and this is the assertion
    // that fails if the offset is ever hardcoded.
    const summer = solarTimes(noonUtc("2026-06-21"), WARSAW.latitude, WARSAW.longitude);
    const winter = solarTimes(noonUtc("2026-12-21"), WARSAW.latitude, WARSAW.longitude);

    expect(summer.sunrise).toBeCloseTo(4 + 14 / 60, 1);
    expect(winter.sunrise).toBeCloseTo(7 + 43 / 60, 1);
  });

  it("orders the day the way a day is ordered", () => {
    const times = solarTimes(noonUtc("2026-06-21"), WARSAW.latitude, WARSAW.longitude);

    expect(times.dawn!).toBeLessThan(times.sunrise!);
    expect(times.sunrise!).toBeLessThan(times.solarNoon);
    expect(times.solarNoon).toBeLessThan(times.sunset!);
    expect(times.sunset!).toBeLessThan(times.dusk!);
  });
});

describe("latitude, which is why one anchor cannot serve the whole country", () => {
  it("gives Suwałki a longer summer day than Zakopane", () => {
    // Five degrees apart, and the gap is over half an hour at the solstice -
    // more than enough to matter to a sky composed from the time of day.
    const date = noonUtc("2026-06-21");
    const suwalki = solarTimes(date, 54.1, 22.93);
    const zakopane = solarTimes(date, 49.3, 19.95);

    const dayLength = (times: { sunrise: number | null; sunset: number | null }) =>
      times.sunset! - times.sunrise!;

    expect(dayLength(suwalki)).toBeGreaterThan(dayLength(zakopane) + 0.5);
  });
});
