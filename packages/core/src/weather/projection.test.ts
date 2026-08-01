import { describe, expect, it } from "vitest";

import { projectShapes, type GeoJsonPolygonGeometry } from "./projection";

const square = (lon: number, lat: number, half = 0.1): GeoJsonPolygonGeometry => ({
  type: "MultiPolygon",
  coordinates: [
    [
      [
        [lon - half, lat - half],
        [lon - half, lat + half],
        [lon + half, lat + half],
        [lon + half, lat - half],
        [lon - half, lat - half],
      ],
    ],
  ],
});

const feature = (terytCode: string, lon: number, lat: number, half?: number) => ({
  properties: { terytCode, name: `powiat ${terytCode}` },
  geometry: square(lon, lat, half),
});

const numbersIn = (d: string) => d.match(/-?\d+\.\d+/g)!.map(Number);

describe("projectShapes", () => {
  it("keeps every shape in one frame rather than fitting each to its own", () => {
    // The whole reason this exists: two powiats of different sizes must stay
    // different sizes, or the picture stops saying anything about where they
    // are relative to each other.
    const [small, large] = projectShapes([
      feature("1465", 21.0, 52.2, 0.05),
      feature("1261", 19.9, 50.0, 0.2),
    ]);

    const extent = (d: string) => {
      const xs = numbersIn(d).filter((_, index) => index % 2 === 0);
      return Math.max(...xs) - Math.min(...xs);
    };

    expect(extent(large!.d)).toBeGreaterThan(extent(small!.d) * 3);
  });

  it("stays inside the box, padding included", () => {
    const shapes = projectShapes([feature("1465", 21.0, 52.2), feature("1261", 19.9, 50.0)], 100, 4);

    for (const shape of shapes) {
      for (const value of numbersIn(shape.d)) {
        expect(value).toBeGreaterThanOrEqual(4 - 0.01);
        expect(value).toBeLessThanOrEqual(96 + 0.01);
      }
    }
  });

  it("corrects for longitude degrees being shorter at Polish latitudes", () => {
    // A square in degrees is not a square on the ground. Without the cosine
    // correction every powiat comes out stretched horizontally.
    const [shape] = projectShapes([feature("1465", 21.0, 52.2, 0.1)]);
    const values = numbersIn(shape!.d);
    const xs = values.filter((_, index) => index % 2 === 0);
    const ys = values.filter((_, index) => index % 2 === 1);

    const width = Math.max(...xs) - Math.min(...xs);
    const height = Math.max(...ys) - Math.min(...ys);

    // cos(52.2 degrees) is about 0.61.
    expect(width / height).toBeCloseTo(0.61, 1);
  });

  it("renders a single tiny powiat instead of collapsing to NaN", () => {
    // A zero-extent bounding box divides by zero; the path then contains NaN
    // and draws nothing, with no error anywhere.
    const [shape] = projectShapes([feature("1465", 21.0, 52.2, 0)]);

    expect(shape!.d).not.toContain("NaN");
  });

  it("returns nothing for no geometry", () => {
    expect(projectShapes([])).toEqual([]);
  });
});
