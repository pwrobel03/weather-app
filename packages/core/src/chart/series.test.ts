import { describe, expect, it } from "vitest";

import {
  areaPath,
  barsFor,
  extentOf,
  indexAtX,
  linePath,
  niceTicks,
  pointsFor,
  scaleX,
  scaleY,
  type Box,
} from "./series";

const box: Box = {
  width: 300,
  height: 100,
  padding: { top: 10, right: 0, bottom: 20, left: 0 },
};

describe("extentOf", () => {
  it("pads the range so a line never runs along an edge", () => {
    // 10..20 padded by a tenth of the span on each side.
    expect(extentOf([10, 15, 20])).toEqual({ min: 9, max: 21 });
  });

  it("survives a series with no spread at all", () => {
    // Twelve hours of exactly 4 degrees is a real forecast, and dividing by a
    // zero span would put every point at NaN.
    expect(extentOf([4, 4, 4])).toEqual({ min: 3, max: 5 });
  });

  it("can be forced to include zero, for a scale that measures amount", () => {
    // A precipitation chart whose bars start at 20% would read as "no rain"
    // for the hour with the least of it.
    expect(extentOf([20, 60], { includeZero: true }).min).toBe(0);
  });

  it("has an answer for no readings at all", () => {
    expect(extentOf([])).toEqual({ min: 0, max: 1 });
  });
});

describe("scales", () => {
  it("puts the maximum at the top of the plot and the minimum at its floor", () => {
    const extent = { min: 0, max: 10 };

    expect(scaleY(10, extent, box)).toBe(box.padding.top);
    expect(scaleY(0, extent, box)).toBe(box.height - box.padding.bottom);
  });

  it("spreads readings edge to edge", () => {
    expect(scaleX(0, 4, box)).toBe(0);
    expect(scaleX(3, 4, box)).toBe(300);
  });

  it("centres a lone reading rather than pinning it left", () => {
    expect(scaleX(0, 1, box)).toBe(150);
  });
});

describe("paths", () => {
  it("draws a polyline through every reading", () => {
    const values = [0, 10];
    const points = pointsFor(values, { min: 0, max: 10 }, box);

    expect(linePath(points)).toBe("M0 80 L300 10");
  });

  it("closes the area against the floor of the plot, not against zero", () => {
    // The temperature scale often has no zero on it; the fill exists to give
    // the line weight and has to sit on the bottom edge either way.
    const points = pointsFor([5, 8], { min: 4, max: 9 }, box);

    expect(areaPath(points, box)).toMatch(/L300 80 L0 80 Z$/);
  });

  it("has nothing to draw for no readings", () => {
    expect(linePath([])).toBe("");
    expect(areaPath([], box)).toBe("");
  });
});

describe("bars", () => {
  it("leaves a gap between neighbours so two bars read as two", () => {
    const bars = barsFor([50, 50], { min: 0, max: 100 }, box, { gap: 2 });

    expect(bars[0]!.width).toBe(148);
    expect(bars[1]!.x - (bars[0]!.x + bars[0]!.width)).toBe(2);
  });

  it("gives the smallest real reading a visible hairline", () => {
    // A 1% chance of rain is not the same statement as no chance of rain, and
    // a zero-height bar says the second one.
    const [bar] = barsFor([1], { min: 0, max: 100 }, box);

    expect(bar!.height).toBeGreaterThanOrEqual(1);
  });

  it("draws nothing for a reading sitting on the floor of the scale", () => {
    const [bar] = barsFor([0], { min: 0, max: 100 }, box);

    expect(bar!.height).toBe(0);
  });
});

describe("niceTicks", () => {
  it("picks intervals a reader does not have to do arithmetic on", () => {
    expect(niceTicks({ min: 0, max: 30 }, 3)).toEqual([0, 10, 20, 30]);
    expect(niceTicks({ min: 0, max: 100 }, 2)).toEqual([0, 50, 100]);
  });

  it("handles a range that does not start at a round number", () => {
    // The step is the smallest of 1/2/5 that covers span/count, so a span of
    // ten asked for three ticks steps by five rather than by three and a third.
    expect(niceTicks({ min: -3, max: 7 }, 3)).toEqual([0, 5]);
  });

  it("keeps zero on the axis when the readings cross it", () => {
    // Freezing is the one temperature a reader looks for, and a scale that
    // steps over it makes them interpolate.
    expect(niceTicks({ min: -6, max: 6 }, 3)).toContain(0);
  });

  it("returns nothing for a range with no span", () => {
    expect(niceTicks({ min: 5, max: 5 })).toEqual([]);
  });
});

describe("indexAtX", () => {
  it("reads the nearest point rather than the slot the cursor fell in", () => {
    // The marks are thin and the pointer is not: just left of a point has to
    // mean that point, not the gap before it.
    expect(indexAtX(0, 4, box)).toBe(0);
    expect(indexAtX(95, 4, box)).toBe(1);
    expect(indexAtX(300, 4, box)).toBe(3);
  });

  it("clamps to the ends rather than reporting a point that is not there", () => {
    expect(indexAtX(-40, 4, box)).toBe(0);
    expect(indexAtX(999, 4, box)).toBe(3);
  });
});
