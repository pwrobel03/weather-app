import { describe, expect, it } from "vitest";

import { composeBackground } from "./background";

const textureAt = (windSpeedKmh: number | undefined, weatherCode = 63) =>
  composeBackground({
    weatherCode,
    temperatureCelsius: 10,
    windSpeedKmh,
    now: new Date("2026-04-15T12:00:00Z"),
    timeZone: "UTC",
  }).texture;

describe("wind channel", () => {
  it("treats a missing reading as still air", () => {
    // The forecast endpoint can fail and the background still has to render.
    // A guessed wind would be a claim about the weather.
    expect(textureAt(undefined).angle).toBe(0);
    expect(textureAt(undefined).speed).toBe(0);
  });

  it("leans further as the wind rises", () => {
    let previous = -1;
    for (const speed of [0, 5, 10, 20, 40, 80, 150]) {
      const angle = textureAt(speed).angle;
      expect(angle, `${speed} km/h`).toBeGreaterThanOrEqual(previous);
      previous = angle;
    }
  });

  it("resolves the everyday range instead of saving itself for a gale", () => {
    // Most Polish days sit between about 5 and 25 km/h. A linear ramp scaled
    // to gale force would leave all of them indistinguishable from still air.
    const everyday = textureAt(25).angle - textureAt(5).angle;
    const total = textureAt(150).angle - textureAt(0).angle;

    expect(everyday / total).toBeGreaterThan(0.4);
  });

  it("never leans so far the fall stops reading as falling", () => {
    expect(textureAt(200).angle).toBeLessThanOrEqual(24);
  });

  it("says nothing when there is nothing falling", () => {
    // A clear sky in a gale has no texture to lean, and inventing one would be
    // decoration rather than a channel.
    expect(textureAt(90, 0).angle).toBe(0);
  });

  it("applies to snow exactly as it applies to rain", () => {
    // The architecture's own rule: wind knows nothing about what is falling,
    // so snow in a gale needs no case of its own.
    expect(textureAt(40, 73).angle).toBe(textureAt(40, 63).angle);
  });
});
