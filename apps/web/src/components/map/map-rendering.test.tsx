import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MapLegend } from "./map-legend";
import { resolveMapSeverity } from "@/lib/map/severity";
import { boundsForLocations, POLAND_BOUNDS, powiatFillPaint } from "@/lib/map/style";

/**
 * The Faza 8 checkpoint: a warning covering 47 powiats paints 47 polygons, in
 * the right colours.
 *
 * Asserted through the pieces rather than through the map, because MapLibre
 * needs a WebGL context jsdom does not have. The parts that can be wrong are
 * the severity resolution, the paint expression and the legend - all three are
 * plain data here.
 */
const codes = (count: number, offset = 0) =>
  Array.from({ length: count }, (_, index) => String(1400 + offset + index));

const alert = (id: number, severity: "1" | "2" | "3", terytCodes: string[]) => ({
  id,
  event: "Silny wiatr",
  severity,
  terytCodes,
});

describe("resolveMapSeverity", () => {
  it("marks every powiat a 47-powiat warning covers", () => {
    const { severityByTeryt, countsByLevel } = resolveMapSeverity([alert(1, "2", codes(47))]);

    expect(Object.keys(severityByTeryt)).toHaveLength(47);
    expect(new Set(Object.values(severityByTeryt))).toEqual(new Set(["2"]));
    expect(countsByLevel).toEqual({ "1": 0, "2": 47, "3": 0 });
  });

  it("shows the worst level when warnings overlap, whatever the order", () => {
    // The one mistake this map must not make: a level 1 issued later hiding a
    // level 3 still in force.
    const shared = ["1465"];
    const severe = resolveMapSeverity([alert(1, "3", shared), alert(2, "1", shared)]);
    const reversed = resolveMapSeverity([alert(1, "1", shared), alert(2, "3", shared)]);

    expect(severe.severityByTeryt["1465"]).toBe("3");
    expect(reversed.severityByTeryt["1465"]).toBe("3");
  });

  it("counts powiats once each, not once per warning covering them", () => {
    // Two warnings over the same 10 powiats is still 10 shapes on the map, and
    // the legend explains the map.
    const { countsByLevel } = resolveMapSeverity([
      alert(1, "2", codes(10)),
      alert(2, "2", codes(10)),
    ]);

    expect(countsByLevel["2"]).toBe(10);
  });

  it("keeps every overlapping warning available to the popover", () => {
    const { alertsByTeryt } = resolveMapSeverity([
      alert(1, "3", ["1465"]),
      alert(2, "1", ["1465"]),
    ]);

    // The fill shows the worst; opening the powiat must still list both.
    expect(alertsByTeryt["1465"]).toHaveLength(2);
  });

  it("paints nothing when nothing is in force", () => {
    const { severityByTeryt, countsByLevel } = resolveMapSeverity([]);

    expect(severityByTeryt).toEqual({});
    expect(countsByLevel).toEqual({ "1": 0, "2": 0, "3": 0 });
  });
});

describe("powiatFillPaint", () => {
  const paint = powiatFillPaint("#QUIET", (level) => `#LEVEL${level}`);

  it("maps each IMGW level to its own colour", () => {
    // The expression is a flat match list: [op, input, 3, colour, 2, colour,
    // 1, colour, fallback].
    const expression = paint["fill-color"] as readonly unknown[];

    expect(expression[expression.indexOf(3) + 1]).toBe("#LEVEL3");
    expect(expression[expression.indexOf(2) + 1]).toBe("#LEVEL2");
    expect(expression[expression.indexOf(1) + 1]).toBe("#LEVEL1");
  });

  it("falls back to the quiet surface for an unwarned powiat", () => {
    const expression = paint["fill-color"] as readonly unknown[];

    expect(expression.at(-1)).toBe("#QUIET");
  });

  it("reads severity from feature state, so a live warning repaints in place", () => {
    // Not from a property: rebuilding the source to repaint would drop the
    // viewport back to the whole country while someone is looking at their own
    // powiat.
    expect(JSON.stringify(paint["fill-color"])).toContain("feature-state");
  });
});

describe("boundsForLocations", () => {
  it("opens on the whole country when the user watches nothing", () => {
    expect(boundsForLocations([])).toEqual(POLAND_BOUNDS);
  });

  it("gives a single location an extent instead of a point", () => {
    // A bare bounding box around one place is zero-sized, and MapLibre answers
    // that by zooming to its maximum.
    const [west, south, east, north] = boundsForLocations([{ latitude: 52.2297, longitude: 21.0122 }]);

    expect(east - west).toBeGreaterThan(0.5);
    expect(north - south).toBeGreaterThan(0.5);
  });

  it("never frames outside Poland", () => {
    // Świnoujście sits hard against the western border; padding it would push
    // the frame past maxBounds, which MapLibre resolves by clamping to
    // somewhere nobody chose.
    const [west, south, east, north] = boundsForLocations([{ latitude: 53.91, longitude: 14.25 }]);

    expect(west).toBeGreaterThanOrEqual(POLAND_BOUNDS[0]);
    expect(south).toBeGreaterThanOrEqual(POLAND_BOUNDS[1]);
    expect(east).toBeLessThanOrEqual(POLAND_BOUNDS[2]);
    expect(north).toBeLessThanOrEqual(POLAND_BOUNDS[3]);
  });

  it("spans every saved location", () => {
    const [west, south, east, north] = boundsForLocations([
      { latitude: 54.35, longitude: 18.65 },
      { latitude: 50.06, longitude: 19.94 },
    ]);

    expect(west).toBeLessThanOrEqual(18.65);
    expect(east).toBeGreaterThanOrEqual(19.94);
    expect(south).toBeLessThanOrEqual(50.06);
    expect(north).toBeGreaterThanOrEqual(54.35);
  });
});

describe("MapLegend", () => {
  it("reports how many powiats sit at each level", () => {
    const { countsByLevel } = resolveMapSeverity([alert(1, "2", codes(47))]);

    render(<MapLegend locale="pl" countsByLevel={countsByLevel} />);

    expect(screen.getByText("47")).toBeInTheDocument();
    expect(screen.getByText("Ostrzeżenie 2. stopnia")).toBeInTheDocument();
  });

  it("keeps every level listed, so the key does not change shape", () => {
    render(<MapLegend locale="en" countsByLevel={{ "1": 0, "2": 47, "3": 0 }} />);

    // "No level 3 anywhere in the country" is itself worth reading.
    expect(screen.getByText("Level 3 warning")).toBeInTheDocument();
    expect(screen.getByText("Level 1 warning")).toBeInTheDocument();
  });

  it("names each level in words, for a reader who cannot separate the hues", () => {
    render(<MapLegend locale="pl" countsByLevel={{ "1": 1, "2": 1, "3": 1 }} />);

    for (const level of ["1", "2", "3"]) {
      expect(screen.getByText(`Ostrzeżenie ${level}. stopnia`)).toBeInTheDocument();
    }
  });
});
