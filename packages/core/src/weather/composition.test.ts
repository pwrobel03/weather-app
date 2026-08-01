import { tokens } from "@weather-app/design-tokens";
import { describe, expect, it } from "vitest";

import { composeBackground } from "./background";
import { hexToOklch } from "./color";

/**
 * The whole-composition guarantees.
 *
 * Every other test in this directory checks one channel. These check what the
 * architecture actually promises: that four times of day, four seasons, every
 * phenomenon, the temperature range and the wind range multiply out to
 * something valid *without anyone having authored the combination*. Eighty-odd
 * variants is exactly the set nobody can review by eye, which is why it is
 * reviewed here instead.
 */

/** Every WMO code the backend can hand us, one per phenomenon group. */
const CODES = [0, 1, 3, 45, 48, 53, 61, 63, 65, 73, 75, 80, 82, 85, 95, 96, 99];
const HOURS = [0, 4, 8, 12, 16, 20, 23];
const DATES = ["01-15", "03-01", "04-15", "07-15", "09-30", "10-15", "12-31"];
const TEMPERATURES = [-25, -8, 12, 30, 45];
const WINDS = [undefined, 8, 90, 200];

function* everyCombination() {
  for (const weatherCode of CODES) {
    for (const date of DATES) {
      for (const hour of HOURS) {
        for (const temperatureCelsius of TEMPERATURES) {
          for (const windSpeedKmh of WINDS) {
            const now = new Date(`2026-${date}T${String(hour).padStart(2, "0")}:00:00Z`);
            yield {
              label: `code ${weatherCode} ${date} ${hour}h ${temperatureCelsius}C wind ${windSpeedKmh}`,
              composition: composeBackground({
                weatherCode,
                temperatureCelsius,
                windSpeedKmh,
                now,
                timeZone: "UTC",
              }),
            };
          }
        }
      }
    }
  }
}

/**
 * IMGW's scale, as hue angles. Reserved by design.md §3: those three colours
 * mean "warning" and must never appear as decoration, or the background starts
 * speaking in the one vocabulary that has to stay unambiguous.
 */
const WARNING_HUES = [tokens.colors.warning1, tokens.colors.warning2, tokens.colors.warning3].map(
  (hex) => hexToOklch(hex).h,
);

/** Wide enough to cover neighbouring hues that would still read as the same
 * colour family - a background that is nearly orange is still a background
 * that argues with a level 2 warning. */
const FORBIDDEN_ARC_DEGREES = 45;

/** Below this, a colour is grey enough that its hue is not readable as a
 * colour at all. */
const MEANINGFUL_CHROMA = 0.03;

function hueDistance(a: number, b: number): number {
  const delta = Math.abs(a - b) % 360;
  return delta > 180 ? 360 - delta : delta;
}

/**
 * Collects violations and asserts once at the end, rather than calling expect
 * inside the loop.
 *
 * Not a style preference: an expect per iteration over ten thousand
 * combinations takes over a minute and times the suite out, and the first
 * failure hides all the others - where what you want from an exhaustive check
 * is the shape of the problem, not one example of it.
 */
function violations(check: (item: ReturnType<typeof compositions>[number]) => string | null): string[] {
  const failures: string[] = [];
  for (const item of compositions()) {
    const failure = check(item);
    if (failure) failures.push(`${item.label}: ${failure}`);
  }
  // Ten examples is enough to see a pattern and short enough to read.
  return failures.slice(0, 10);
}

let cached: ReturnType<typeof build> | null = null;
function compositions() {
  cached ??= build();
  return cached;
}

function build() {
  return [...everyCombination()];
}

describe("channel composition", () => {
  it("covers a set nobody could review by hand", () => {
    // The premise of the phase, stated as a number: this is why combinations
    // are computed rather than authored.
    expect(compositions().length).toBeGreaterThan(3000);
  });

  it("never produces a colour from the IMGW warning scale", () => {
    expect(
      violations(({ composition }) => {
        for (const hex of [composition.sky.from, composition.sky.to]) {
          const { h, c } = hexToOklch(hex);
          if (c < MEANINGFUL_CHROMA) continue;

          for (const warningHue of WARNING_HUES) {
            if (hueDistance(h, warningHue) <= FORBIDDEN_ARC_DEGREES) {
              return `${hex} sits ${hueDistance(h, warningHue).toFixed(0)} degrees from a warning hue`;
            }
          }
        }
        return null;
      }),
    ).toEqual([]);
  });

  it("stays a sky in every combination", () => {
    // Not merely "not a warning colour": the background has to stay
    // recognisably sky-coloured across all four seasons and all 24 hours, or
    // one channel has quietly taken over from the others.
    expect(
      violations(({ composition }) => {
        const { h } = hexToOklch(composition.sky.from);
        return h > 190 && h < 310 ? null : `hue ${h.toFixed(0)} is outside the blues`;
      }),
    ).toEqual([]);
  });

  it("emits valid sRGB, never NaN", () => {
    // A NaN in a colour renders as nothing at all with no error anywhere - the
    // failure mode this module is most exposed to.
    const hex = /^#[0-9A-F]{6}$/;

    expect(
      violations(({ composition }) => {
        if (!hex.test(composition.sky.from)) return `bad colour ${composition.sky.from}`;
        if (!hex.test(composition.sky.to)) return `bad colour ${composition.sky.to}`;
        if (Number.isNaN(composition.texture.angle)) return "texture angle is NaN";
        if (Number.isNaN(composition.veil.opacity)) return "veil opacity is NaN";
        return null;
      }),
    ).toEqual([]);
  });

  it("keeps the hero dark enough for white text and light enough to be a sky", () => {
    // The hero carries a 96px temperature and a metrics strip in white. A
    // combination that brightened the sky past this would fail contrast in a
    // way no single channel intends and no single channel owns.
    expect(
      violations(({ composition }) => {
        const from = hexToOklch(composition.sky.from).l;
        const to = hexToOklch(composition.sky.to).l;

        if (from >= 0.75) return `top is too light (${from.toFixed(2)})`;
        if (to <= 0.1) return `bottom is nearly black (${to.toFixed(2)})`;
        return null;
      }),
    ).toEqual([]);
  });

  it("keeps the gradient a gradient", () => {
    // Top and bottom have to stay distinguishable, or the hero becomes a flat
    // swatch - which is how it read before the panel got its rounding and its
    // shadow, as a block rather than an object.
    expect(
      violations(({ composition }) => {
        const spread =
          hexToOklch(composition.sky.from).l - hexToOklch(composition.sky.to).l;
        return spread > 0.03 ? null : `top and bottom differ by only ${spread.toFixed(3)}`;
      }),
    ).toEqual([]);
  });

  it("stays inside the sRGB gamut, so two combinations cannot collapse into one", () => {
    // Past the gamut everything clips to the same colour, and two different
    // states become one with nothing to say they did.
    expect(
      violations(({ composition }) => {
        const chroma = hexToOklch(composition.sky.from).c;
        return chroma < 0.3 ? null : `chroma ${chroma.toFixed(3)} is clipping`;
      }),
    ).toEqual([]);
  });

  it("is a pure function of its inputs", () => {
    // Same inputs, same output - the property that makes a server render and a
    // client render agree, and the one that makes every test above meaningful.
    const input = {
      weatherCode: 95,
      temperatureCelsius: 21,
      windSpeedKmh: 35,
      now: new Date("2026-07-15T18:30:00Z"),
      timeZone: "Europe/Warsaw",
    };

    expect(composeBackground(input)).toEqual(composeBackground(input));
  });
});

/**
 * The same guarantees, with the sky anchored to real solar events.
 *
 * Commit 128 moved the time-of-day anchors from three fixed hours onto each
 * location's own sunrise, solar noon and sunset. Every promise above was
 * verified against the old anchors, and a promise verified against inputs that
 * no longer occur is not a promise - the composition now reaches colours it
 * never reached before, because a December dusk starts at 15:25 instead of at
 * 19:00.
 *
 * A separate grid rather than another dimension on the one above. Solar
 * anchors move the time-of-day channel and nothing else, so multiplying the
 * temperature and wind axes by three places would quadruple the runtime to
 * re-check arithmetic that cannot have changed.
 */
const PLACES = [
  { label: "Suwałki", latitude: 54.1, longitude: 22.93 },
  { label: "Warszawa", latitude: 52.23, longitude: 21.01 },
  { label: "Zakopane", latitude: 49.3, longitude: 19.95 },
];

/** Every other hour, so both twilights land inside the sample in every season. */
const SOLAR_HOURS = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22];

function* everySolarCombination() {
  for (const place of PLACES) {
    for (const weatherCode of [0, 3, 65, 75, 95]) {
      for (const date of DATES) {
        for (const hour of SOLAR_HOURS) {
          for (const temperatureCelsius of [-25, 12, 45]) {
            const now = new Date(`2026-${date}T${String(hour).padStart(2, "0")}:00:00Z`);
            yield {
              label: `${place.label} code ${weatherCode} ${date} ${hour}h ${temperatureCelsius}C`,
              composition: composeBackground({
                weatherCode,
                temperatureCelsius,
                now,
                timeZone: "Europe/Warsaw",
                latitude: place.latitude,
                longitude: place.longitude,
              }),
            };
          }
        }
      }
    }
  }
}

describe("channel composition with solar anchors", () => {
  it("never produces a colour from the IMGW warning scale", () => {
    // The guarantee that matters most, re-run over the colours the new
    // anchors actually reach. A dusk that now begins three hours earlier in
    // December puts dusk hues over winter's own tilt for the first time.
    const violations: string[] = [];

    for (const { label, composition } of everySolarCombination()) {
      for (const hex of [composition.sky.from, composition.sky.to]) {
        const { h, c } = hexToOklch(hex);
        if (c < MEANINGFUL_CHROMA) continue;

        for (const warningHue of WARNING_HUES) {
          const distance = Math.min(Math.abs(h - warningHue), 360 - Math.abs(h - warningHue));
          if (distance < FORBIDDEN_ARC_DEGREES) {
            violations.push(`${label}: ${hex} is ${distance.toFixed(1)}° from a warning hue`);
          }
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it("emits valid sRGB, never NaN", () => {
    // Solar times can be null - polar day, polar night - and a null that
    // reached the arithmetic would surface here as NaN rather than as a crash.
    // Poland never sees one, but the fallback that prevents it is worth pinning.
    const bad: string[] = [];

    for (const { label, composition } of everySolarCombination()) {
      for (const hex of [composition.sky.from, composition.sky.to]) {
        if (!/^#[0-9a-f]{6}$/i.test(hex)) bad.push(`${label}: ${hex}`);
      }
      // The glow is emitted as rgba, not hex - it carries an alpha. Checked
      // for the same thing by a different shape: no NaN anywhere in it.
      for (const value of [composition.glow.color, composition.glow.secondary]) {
        if (!/^rgba\(\d+(\.\d+)?, \d+(\.\d+)?, \d+(\.\d+)?, [\d.]+\)$/.test(value)) {
          bad.push(`${label}: ${value}`);
        }
      }
    }

    expect(bad).toEqual([]);
  });

  it("keeps the hero dark enough for white text", () => {
    // The hero is dark in both themes and carries white type, so this bound
    // is what commit 107 audited the contrast against. New anchors, same bound.
    const tooLight: string[] = [];

    for (const { label, composition } of everySolarCombination()) {
      for (const hex of [composition.sky.from, composition.sky.to]) {
        if (hexToOklch(hex).l > 0.72) tooLight.push(`${label}: ${hex}`);
      }
    }

    expect(tooLight).toEqual([]);
  });

  it("puts a darker sky over Suwałki than over Zakopane on a winter afternoon", () => {
    // The whole point of the change, asserted as a difference rather than as a
    // colour: at 15:30 in December the sun has set in the north-east and not
    // yet in the south. Under fixed anchors both were "day" and identical.
    const at = (place: (typeof PLACES)[number]) =>
      composeBackground({
        weatherCode: 0,
        temperatureCelsius: -2,
        now: new Date("2026-12-21T14:30:00Z"),
        timeZone: "Europe/Warsaw",
        latitude: place.latitude,
        longitude: place.longitude,
      });

    const north = hexToOklch(at(PLACES[0]!).sky.from).l;
    const south = hexToOklch(at(PLACES[2]!).sky.from).l;

    expect(north).toBeLessThan(south);
  });

  it("agrees with the fixed anchors near an equinox, when they were right", () => {
    // The fixed hours were an equinox day at Polish latitudes, so around the
    // equinox the two should barely differ. A large gap here would mean the
    // solar path is wrong rather than merely different.
    const now = new Date("2026-03-20T09:00:00Z");
    const common = { weatherCode: 0, temperatureCelsius: 8, now, timeZone: "Europe/Warsaw" };

    const fixed = composeBackground(common);
    const solar = composeBackground({ ...common, latitude: 52.23, longitude: 21.01 });

    expect(solar.channels.timeOfDay).toBe(fixed.channels.timeOfDay);
    expect(Math.abs(hexToOklch(solar.sky.from).l - hexToOklch(fixed.sky.from).l)).toBeLessThan(0.1);
  });
});
