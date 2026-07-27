import { describe, expect, it } from "vitest";

import { composeBackground } from "./background";
import { hexToOklch } from "./color";

const at = (weatherCode: number) =>
  composeBackground({
    weatherCode,
    temperatureCelsius: 18,
    now: new Date("2026-07-15T12:00:00Z"),
    timeZone: "UTC",
  });

describe("thunderstorm channel", () => {
  it("stays out of the way when there is no storm", () => {
    for (const code of [0, 3, 45, 63, 73]) {
      expect(at(code).storm, `code ${code}`).toEqual({ active: false, intensity: 0 });
    }
  });

  it("treats a storm with hail as heavier weather than one without", () => {
    expect(at(95).storm.intensity).toBeGreaterThan(0);
    expect(at(99).storm.intensity).toBeGreaterThan(at(95).storm.intensity);
  });

  it("darkens the sky before anything flashes", () => {
    // Most of this channel is the state, not the event: a storm sky is darker
    // whether or not lightning happens to be striking this second - which is
    // also what makes the channel legible with animation turned off.
    expect(hexToOklch(at(95).sky.from).l).toBeLessThan(hexToOklch(at(63).sky.from).l);
  });

  it("darkens proportionally to intensity", () => {
    expect(hexToOklch(at(99).sky.from).l).toBeLessThan(hexToOklch(at(95).sky.from).l);
  });

  it("writes only to lightness, leaving the other channels their dimensions", () => {
    // Season owns hue, temperature owns chroma. If the storm moved either, the
    // composition would stop being evaluable in any order.
    const storm = hexToOklch(at(95).sky.from);
    const rain = hexToOklch(at(63).sky.from);

    expect(Math.abs(storm.h - rain.h)).toBeLessThan(2);
    expect(Math.abs(storm.c - rain.c)).toBeLessThan(0.02);
  });

  it("keeps a storm sky out of the black", () => {
    // Darkening is a signal, not a fade-out: the hero has to stay a sky, and
    // the text on it has to stay readable.
    expect(hexToOklch(at(99).sky.to).l).toBeGreaterThan(0.2);
  });
});
