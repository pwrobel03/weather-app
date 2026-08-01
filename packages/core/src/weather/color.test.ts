import { describe, expect, it } from "vitest";

import { adjust, hexToOklch, oklchToHex } from "./color";

describe("OKLCH conversion", () => {
  it("round-trips a colour without drifting", () => {
    // Every channel composes on top of this, so a lossy round trip would show
    // up as the sky slowly changing colour as more channels are added.
    for (const hex of ["#4C9EDE", "#245A93", "#7B5AB8", "#0C1220", "#FFFFFF", "#000000"]) {
      expect(oklchToHex(hexToOklch(hex))).toBe(hex);
    }
  });

  it("accepts shorthand hex", () => {
    expect(oklchToHex(hexToOklch("#4CF"))).toBe("#44CCFF");
  });

  it("changes hue without changing perceived lightness", () => {
    // The reason for OKLCH over HSL. In HSL a hue rotation moves lightness
    // with it, so tilting the winter sky towards blue would also darken it -
    // and correcting for that by hand is how a channel system turns back into
    // a table of hand-picked combinations.
    const before = hexToOklch("#4C9EDE");
    const after = hexToOklch(adjust("#4C9EDE", { hueShift: 40 }));

    expect(after.l).toBeCloseTo(before.l, 3);
    // Tolerances are in the units of an 8-bit hex channel, not of the maths:
    // the result round-trips through #RRGGBB, and at this chroma one step of
    // rounding is a fraction of a degree of hue.
    expect(Math.abs(after.h - ((before.h + 40) % 360))).toBeLessThan(0.5);
  });

  it("scales chroma without touching hue", () => {
    const before = hexToOklch("#4C9EDE");
    const after = hexToOklch(adjust("#4C9EDE", { chromaScale: 0.5 }));

    // Two decimals, not three: the value round-trips through an 8-bit hex
    // channel, so the last fraction of chroma is lost to quantisation.
    expect(after.c).toBeCloseTo(before.c * 0.5, 2);
    // Halving the chroma halves the radius, so the same rounding error is
    // twice the angle - the hue is still stable, just measured coarsely.
    expect(Math.abs(after.h - before.h)).toBeLessThan(1);
  });

  it("is the identity when a channel has nothing to say", () => {
    // What makes the channels composable in any order: a channel that does not
    // speak to a dimension must leave it exactly as it was.
    expect(adjust("#4C9EDE", {})).toBe("#4C9EDE");
  });

  it("keeps a hue shift past 360 degrees on the circle", () => {
    expect(adjust("#4C9EDE", { hueShift: 400 })).toBe(adjust("#4C9EDE", { hueShift: 40 }));
  });

  it("never emits a colour outside sRGB", () => {
    // A combination landing outside the gamut clips; the guard is here so that
    // shows up as a bounded colour rather than as NaN in a paint value.
    const extreme = adjust("#4C9EDE", { chromaScale: 20, lightnessShift: 0.9 });

    expect(extreme).toMatch(/^#[0-9A-F]{6}$/);
  });
});
