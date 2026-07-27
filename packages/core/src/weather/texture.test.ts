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

  it("gives snow and hail their own fall", () => {
    // Grouped with rain, they would fall as streaks - which is the one thing
    // neither of them does.
    expect(textureFor(73).kind).toBe("snow");
    expect(textureFor(96).kind).toBe("hail");
  });

  it("keeps snow the brightest fall in the set", () => {
    // Snow is the one phenomenon that makes a scene brighter rather than
    // darker, so its veil is the lightest of the falling group and the texture
    // carries it almost alone.
    expect(veilFor(73).opacity).toBeLessThan(veilFor(63).opacity);
    expect(textureFor(73).density).toBeGreaterThan(0.5);
  });

  it("makes hail heavier than snow in the veil, not in the count", () => {
    // The difference is violence, and violence is contrast and size rather
    // than how many marks are on screen.
    expect(veilFor(96).opacity).toBeGreaterThan(veilFor(73).opacity);
    expect(textureFor(96).density).toBeLessThan(textureFor(73).density);
  });

  it("only calls it hail when the code actually says hail", () => {
    // WMO names hail only alongside a thunderstorm, and only in 96 and 99 -
    // a plain thunderstorm at 95 throws water.
    expect(textureFor(95).kind).toBe("rain");
    expect(textureFor(99).kind).toBe("hail");
  });

  it("treats showers as rain", () => {
    // Codes 80-82 are showers, which fall the same way an ordinary rain does -
    // the icon is where that distinction belongs, not the background.
    for (const code of [80, 81, 82]) {
      expect(textureFor(code).kind, `code ${code}`).toBe("rain");
    }
  });
});
