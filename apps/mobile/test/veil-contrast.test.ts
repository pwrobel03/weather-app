import { describe, expect, it } from "vitest";

import { contrastMatrix, veilContrastAmount } from "../src/components/veil-contrast";

/**
 * The arithmetic behind the phenomenon channel's contrast, which a render test
 * cannot reach: the matrix goes to Skia, and what it does there was wrong for
 * one whole phase without a single test failing. These cover the numbers; the
 * question of *what* gets filtered is answered by the component structure.
 */
describe("veil contrast", () => {
  it("scales the amount by the veil's opacity, matching how CSS composites it", () => {
    // Storm: contrast 1.1 behind a veil at 0.72 opacity. The web blends the
    // filtered backdrop at that opacity, so only 72% of the tilt lands.
    expect(veilContrastAmount({ contrast: 1.1, opacity: 0.72 })).toBeCloseTo(1.072, 5);
  });

  it("leaves a fully opaque veil at its stated amount", () => {
    expect(veilContrastAmount({ contrast: 1.1, opacity: 1 })).toBeCloseTo(1.1, 5);
  });

  it("is a no-op filter when the veil is invisible", () => {
    // Guards the boundary the component checks before rendering the filter at
    // all: a transparent veil must not tint what is behind it.
    expect(veilContrastAmount({ contrast: 1.4, opacity: 0 })).toBe(1);
  });

  it("keeps mid-grey fixed, which is what makes it a contrast and not a brightness", () => {
    const matrix = contrastMatrix(2);
    const [scale, , , , shift] = matrix;
    const mid = 0.5;

    expect(scale! * mid + shift!).toBeCloseTo(mid, 5);
  });

  it("passes alpha through untouched", () => {
    // Row four is alpha: scaling it would make the veil's own transparency a
    // function of the weather.
    expect(contrastMatrix(1.6).slice(15)).toEqual([0, 0, 0, 1, 0]);
  });
});
