import { describe, expect, it } from "vitest";

import { conditionFromWeatherCode } from "./condition";
import { weatherScene } from "./scene";

/**
 * The scene mapping exists so apps/web and apps/mobile cannot disagree about
 * which icon a WMO code shows. These tests pin the cases where that mapping is
 * easy to get subtly wrong.
 */
describe("weatherScene", () => {
  it("swaps the sun for the moon at night, and only the sun", () => {
    // Centred vertically, unlike every other scene: with no cloud beneath it
    // the luminary owns the whole box, and the renderers' default position is
    // the one meant for sitting above one.
    expect(weatherScene(0, false)).toEqual([{ part: "sun", cy: 32 }]);
    expect(weatherScene(0, true)).toEqual([{ part: "moon", cy: 32 }]);

    // Rain looks the same at 3am as at 3pm.
    expect(weatherScene(61, true)).toEqual(weatherScene(61, false));
  });

  it("draws every WMO code the backend can return", () => {
    // Open-Meteo's published code list. A gap here renders as a bare cloud,
    // which is a silent wrong answer rather than a crash.
    const codes = [
      0, 1, 2, 3, 45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82,
      85, 86, 95, 96, 99,
    ];

    for (const code of codes) {
      expect(weatherScene(code, false).length, `code ${code}`).toBeGreaterThan(0);
    }
  });

  it("escalates rain: more drops, then slanted drops", () => {
    const moderate = weatherScene(63, false).find((part) => part.part === "drops");
    const heavy = weatherScene(65, false).find((part) => part.part === "drops");

    expect(moderate).toMatchObject({ count: 3 });
    expect(heavy).toMatchObject({ count: 5, heavy: true });
  });

  it("shows hail only for the two codes that mean hail", () => {
    const withHail = [96, 99];
    for (const code of [95, ...withHail]) {
      const hasHail = weatherScene(code, false).some((part) => part.part === "hailstones");
      expect(hasHail, `code ${code}`).toBe(withHail.includes(code));
    }
  });

  it("agrees with the condition phrase about what is falling", () => {
    // The icon is more literal than the phrase, but the two must not contradict
    // each other - a snowflake next to the word "Deszcz" is a bug the type
    // system cannot catch.
    const snowCodes = [71, 73, 75, 77, 85, 86];

    for (const code of snowCodes) {
      expect(conditionFromWeatherCode(code)).toMatch(/snow/i);
      expect(weatherScene(code, false).some((part) => part.part === "flakes")).toBe(true);
    }
  });
});
