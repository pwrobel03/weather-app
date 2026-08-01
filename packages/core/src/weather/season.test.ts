import { describe, expect, it } from "vitest";

import { composeBackground } from "./background";
import { hexToOklch } from "./color";
import { season, seasonBlendFromDayOfYear } from "./season";

/**
 * The sky on a given date, with every other channel held still.
 *
 * The timeZone is UTC rather than Europe/Warsaw on purpose: Warsaw is UTC+1 in
 * January and UTC+2 in July, so the same instant is a different local hour in
 * the two, and comparing a winter sky to a summer one would really be
 * comparing early afternoon to late afternoon. The first version of this test
 * did exactly that and blamed the season channel for it.
 */
const skyAt = (isoDate: string) =>
  hexToOklch(
    composeBackground({
      weatherCode: 0,
      temperatureCelsius: 10,
      now: new Date(`${isoDate}T12:00:00Z`),
      timeZone: "UTC",
    }).sky.from,
  );

describe("season channel", () => {
  it("is fully itself at each anchor", () => {
    expect(seasonBlendFromDayOfYear(15)).toMatchObject({ from: "winter", t: 0 });
    expect(seasonBlendFromDayOfYear(196)).toMatchObject({ from: "summer", t: 0 });
  });

  it("wraps through New Year instead of falling off the end", () => {
    // 3 January belongs to the autumn-to-winter segment that started in
    // October. Getting this wrong paints the first fortnight of the year with
    // whatever the fallback happens to be.
    const january = seasonBlendFromDayOfYear(3);

    expect(january.from).toBe("autumn");
    expect(january.to).toBe("winter");
    expect(january.t).toBeGreaterThan(0.8);
  });

  it("covers every day of the year", () => {
    for (let day = 1; day <= 365; day += 1) {
      const blend = seasonBlendFromDayOfYear(day);
      expect(blend.t, `day ${day}`).toBeGreaterThanOrEqual(0);
      expect(blend.t, `day ${day}`).toBeLessThanOrEqual(1);
    }
  });

  it("names the season nearest the date", () => {
    expect(season(new Date("2026-01-15T12:00:00Z"))).toBe("winter");
    expect(season(new Date("2026-07-15T12:00:00Z"))).toBe("summer");
    expect(season(new Date("2026-10-15T12:00:00Z"))).toBe("autumn");
  });

  it("tilts winter cooler and paler than summer", () => {
    const winter = skyAt("2026-01-15");
    const summer = skyAt("2026-07-15");

    // Direction matters and is easy to get backwards: within the blues, a
    // *lower* OKLCH hue angle runs towards cyan and steel, a higher one
    // towards violet. Winter therefore sits below summer - and it has to,
    // because violet is where dusk lives, and a winter noon must not look like
    // an evening.
    expect(winter.h).toBeLessThan(summer.h);
    expect(winter.c).toBeLessThan(summer.c);
  });

  it("does not cut on the first of a month", () => {
    // Meteorological spring starts on 1 March, and nobody experiences that as
    // a switch.
    const before = skyAt("2026-02-28");
    const after = skyAt("2026-03-01");

    expect(Math.abs(after.h - before.h)).toBeLessThan(0.5);
  });

  it("stays a sky all year", () => {
    // A season that repainted the background would stop being a channel and
    // start being a theme. Every day of the year has to stay in the blues -
    // which is also what keeps it clear of IMGW's yellow-orange-red band.
    for (const date of ["2026-01-15", "2026-04-15", "2026-07-15", "2026-10-15"]) {
      const { h } = skyAt(date);
      expect(h, date).toBeGreaterThan(200);
      expect(h, date).toBeLessThan(300);
    }
  });
});
