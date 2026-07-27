import { describe, expect, it } from "vitest";

import { composeBackground } from "./background";
import { temperatureSaturation } from "./channels";
import { hexToOklch } from "./color";

const chromaAt = (temperatureCelsius: number) =>
  hexToOklch(
    composeBackground({
      weatherCode: 0,
      temperatureCelsius,
      now: new Date("2026-04-15T12:00:00Z"),
      timeZone: "UTC",
    }).sky.from,
  ).c;

describe("temperature channel", () => {
  it("rises with temperature, everywhere", () => {
    let previous = -Infinity;
    for (let celsius = -25; celsius <= 40; celsius += 1) {
      const value = temperatureSaturation(celsius);
      expect(value, `${celsius}C`).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });

  it("clamps at both ends, so a freak reading cannot drain or blow out the sky", () => {
    expect(temperatureSaturation(-40)).toBe(temperatureSaturation(-20));
    expect(temperatureSaturation(45)).toBe(temperatureSaturation(35));
  });

  it("spends its resolution on temperatures that actually occur", () => {
    // The calibration this channel is about. Poland's records are near -41 and
    // +40, but a Polish year lives between about -10 and +30. A linear ramp
    // across the full range would put most ordinary days within a few percent
    // of each other, and the channel would say nothing on the days anyone sees.
    const everyday = temperatureSaturation(30) - temperatureSaturation(-10);
    const total = temperatureSaturation(35) - temperatureSaturation(-20);

    expect(everyday / total).toBeGreaterThan(0.85);
  });

  it("survives a missing reading instead of painting NaN", () => {
    // The forecast endpoint returns null on upstream failure, and a NaN here
    // propagates into a colour that renders as nothing at all.
    expect(temperatureSaturation(Number.NaN)).toBe(1);
  });

  it("makes a cold sky paler and a warm one denser", () => {
    expect(chromaAt(-15)).toBeLessThan(chromaAt(25));
  });

  it("never pushes the sky out of sRGB", () => {
    // Chroma has no upper bound in OKLCH; everything past the gamut clips to
    // the same colour, which would silently flatten two temperatures into one.
    for (const celsius of [-40, -20, 0, 20, 35, 50]) {
      const hex = composeBackground({
        weatherCode: 0,
        temperatureCelsius: celsius,
        now: new Date("2026-07-15T12:00:00Z"),
        timeZone: "UTC",
      }).sky.from;

      expect(hexToOklch(hex).c, `${celsius}C`).toBeLessThan(0.3);
    }
  });

  it("leaves the hue alone - that belongs to the season channel", () => {
    const cold = hexToOklch(
      composeBackground({
        weatherCode: 0,
        temperatureCelsius: -15,
        now: new Date("2026-04-15T12:00:00Z"),
        timeZone: "UTC",
      }).sky.from,
    );
    const warm = hexToOklch(
      composeBackground({
        weatherCode: 0,
        temperatureCelsius: 30,
        now: new Date("2026-04-15T12:00:00Z"),
        timeZone: "UTC",
      }).sky.from,
    );

    // One channel, one dimension. If temperature moved hue too, the two would
    // fight over the same value and the composition would stop being an
    // arbitrary-order product.
    expect(Math.abs(warm.h - cold.h)).toBeLessThan(2);
  });
});
