import { describe, expect, it } from "vitest";

import { composeBackground } from "./background";

const textureFor = (weatherCode: number) =>
  composeBackground({
    weatherCode,
    temperatureCelsius: 10,
    now: new Date("2026-04-15T12:00:00Z"),
    timeZone: "UTC",
  }).texture;

const veilFor = (weatherCode: number) =>
  composeBackground({
    weatherCode,
    temperatureCelsius: 10,
    now: new Date("2026-04-15T12:00:00Z"),
    timeZone: "UTC",
  }).veil;

describe("precipitation channel", () => {
  it("gives rain more presence than drizzle", () => {
    expect(textureFor(63).kind).toBe("rain");
    expect(textureFor(53).kind).toBe("drizzle");
    expect(textureFor(63).density).toBeGreaterThan(textureFor(53).density);
  });

  it("leaves a clear sky with nothing falling", () => {
    expect(textureFor(0)).toMatchObject({ kind: "none", density: 0 });
  });

  it("keeps fog a veil rather than a fall", () => {
    // The single easiest way to make fog read as rain is to give it texture.
    // It has the heaviest veil in the set and no streaks whatsoever.
    expect(textureFor(45).density).toBe(0);
    expect(veilFor(45).opacity).toBeGreaterThan(veilFor(53).opacity);
  });

  it("keeps density and veil opacity as separate quantities", () => {
    // Drizzle: light veil, dense streaks. Fog: heavy veil, no streaks. One
    // value cannot carry both, which is why there are two.
    const drizzle = { texture: textureFor(53), veil: veilFor(53) };
    const fog = { texture: textureFor(45), veil: veilFor(45) };

    expect(drizzle.texture.density).toBeGreaterThan(fog.texture.density);
    expect(drizzle.veil.opacity).toBeLessThan(fog.veil.opacity);
  });

  it("treats showers as rain", () => {
    // Codes 80-82 are showers, which fall the same way an ordinary rain does -
    // the icon is where that distinction belongs, not the background.
    for (const code of [80, 81, 82]) {
      expect(textureFor(code).kind, `code ${code}`).toBe("rain");
    }
  });
});
