import { describe, expect, it } from "vitest";

import { composeBackground } from "./background";
import { timeOfDayBlendFromHour } from "./channels";
import { hexToOklch } from "./color";

describe("time-of-day channel", () => {
  it("is fully itself at each anchor hour", () => {
    expect(timeOfDayBlendFromHour(1)).toMatchObject({ from: "night", t: 0 });
    expect(timeOfDayBlendFromHour(7)).toMatchObject({ from: "dawn", t: 0 });
    expect(timeOfDayBlendFromHour(13)).toMatchObject({ from: "day", t: 0 });
    expect(timeOfDayBlendFromHour(19)).toMatchObject({ from: "dusk", t: 0 });
  });

  it("wraps past midnight instead of falling off the end", () => {
    // 00:30 belongs to the dusk-to-night segment that started at 19:00, not to
    // a case of its own. Getting this wrong leaves the small hours painted
    // with whatever the fallback happens to be.
    const halfPastMidnight = timeOfDayBlendFromHour(0.5);

    expect(halfPastMidnight.from).toBe("dusk");
    expect(halfPastMidnight.to).toBe("night");
    expect(halfPastMidnight.t).toBeGreaterThan(0.9);
  });

  it("covers all 24 hours with no gap", () => {
    for (let hour = 0; hour < 24; hour += 0.25) {
      const blend = timeOfDayBlendFromHour(hour);
      expect(blend.t, `hour ${hour}`).toBeGreaterThanOrEqual(0);
      expect(blend.t, `hour ${hour}`).toBeLessThanOrEqual(1);
    }
  });

  it("moves the sky continuously rather than switching at a boundary", () => {
    // The reason this channel exists. With a lookup on the discrete bucket,
    // 16:59 and 17:01 are two unrelated skies and the change is a visible cut
    // on a surface whose whole job is to be a state nobody has to read.
    const at = (hour: number, minute: number) =>
      composeBackground({
        weatherCode: 0,
        temperatureCelsius: 15,
        now: new Date(Date.UTC(2026, 6, 27, hour - 2, minute)),
      }).sky.from;

    const before = hexToOklch(at(16, 59));
    const after = hexToOklch(at(17, 1));

    // Two minutes apart: a step, not a jump.
    expect(Math.abs(after.l - before.l)).toBeLessThan(0.01);
  });

  it("does move the sky measurably across the afternoon", () => {
    // The other half of the same claim: continuous must not mean static.
    const at = (hour: number) =>
      hexToOklch(
        composeBackground({
          weatherCode: 0,
          temperatureCelsius: 15,
          now: new Date(Date.UTC(2026, 6, 27, hour - 2, 0)),
        }).sky.from,
      );

    expect(Math.abs(at(21).l - at(13).l)).toBeGreaterThan(0.05);
  });

  it("travels the glow down the panel instead of teleporting", () => {
    const glowY = (hour: number) =>
      Number(
        composeBackground({
          weatherCode: 0,
          temperatureCelsius: 15,
          now: new Date(Date.UTC(2026, 6, 27, hour - 2, 0)),
        }).glow.y.replace("%", ""),
      );

    // Day sits at 8%, dusk at 30%: the hours between must be between.
    const midway = glowY(16);
    expect(midway).toBeGreaterThan(glowY(13));
    expect(midway).toBeLessThan(glowY(19));
  });

  it("reads the hour at the location, not on the viewer's machine", () => {
    // Someone in London looking at Warszawa must see Warszawa's night.
    const midnightInWarsaw = new Date("2026-07-27T22:00:00Z");

    expect(
      composeBackground({
        weatherCode: 0,
        temperatureCelsius: 15,
        now: midnightInWarsaw,
        timeZone: "Europe/Warsaw",
      }).channels.timeOfDay,
    ).toBe("night");
  });
});
