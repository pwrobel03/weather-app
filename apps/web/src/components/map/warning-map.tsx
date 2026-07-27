"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import type { Map as MapLibreMap } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";

import type { WarningSeverityLevel } from "@/components/alert-takeover";
import type { PowiatFeatureCollection } from "@/lib/map/boundaries";
import { POLAND_BOUNDS, warningMapStyle } from "@/lib/map/style";

type WarningMapProps = {
  className?: string;
  /** Announced to assistive technology - the canvas itself says nothing. */
  label: string;
  /** Every powiat, fetched on the server (see lib/map/boundaries). */
  boundaries: PowiatFeatureCollection;
  /** TERYT code -> the highest IMGW level in force there, if any. */
  severityByTeryt: Record<string, WarningSeverityLevel>;
};

/**
 * The map surface.
 *
 * MapLibre is loaded with a dynamic import inside an effect rather than at
 * module scope. It touches `window` on import and weighs several hundred
 * kilobytes, and this is the only screen that needs it - a static import would
 * break the server render and put the whole library in the shared bundle.
 *
 * The background colour comes from the resolved CSS custom property rather
 * than a literal, so the map follows the theme like everything else. MapLibre
 * paints into a canvas and cannot read `var()`, so it has to be read out once
 * and handed over.
 */
export function WarningMap({ className, label, boundaries, severityByTeryt }: WarningMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<MapLibreMap | null>(null);

  useEffect(() => {
    if (!container.current) return;

    let disposed = false;
    let created: MapLibreMap | null = null;

    void (async () => {
      const { Map, NavigationControl } = await import("maplibre-gl");

      // The effect can be torn down while the import is still in flight -
      // React runs effects twice in development, and a map created after
      // unmount leaks a WebGL context that never gets released.
      if (disposed || !container.current) return;

      const styles = getComputedStyle(document.documentElement);
      const background = styles.getPropertyValue("--muted").trim() || "#16202F";

      created = new Map({
        container: container.current,
        style: warningMapStyle(background),
        bounds: POLAND_BOUNDS,
        fitBoundsOptions: { padding: 24 },
        maxBounds: POLAND_BOUNDS,
        // No basemap means no attribution to display, and an empty control
        // box in the corner reads as something failing to load.
        attributionControl: false,
        // Pitch and rotation buy nothing here: these are flat administrative
        // shapes, and a tilted powiat is a harder powiat to recognise.
        pitchWithRotate: false,
        dragRotate: false,
        touchZoomRotate: false,
      });

      created.addControl(new NavigationControl({ showCompass: false }), "top-right");
      created.on("load", () => {
        if (disposed || !created) return;
        addBoundaryLayers(created, boundaries, styles);
        setMap(created);
      });
    })();

    return () => {
      disposed = true;
      created?.remove();
      setMap(null);
    };
    // `boundaries` is server-fetched and stable for the life of the page;
    // rebuilding the map on a new object identity would flash the whole canvas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Severity is applied separately from the layers, and re-applied whenever it
  // changes. A warning arriving over the WebSocket must repaint the map, and
  // rebuilding the source to do it would drop the viewport back to Poland
  // while the user was looking at their own powiat.
  useEffect(() => {
    if (!map) return;
    applySeverity(map, boundaries, severityByTeryt);
  }, [map, boundaries, severityByTeryt]);

  return (
    <div
      ref={container}
      role="img"
      aria-label={label}
      data-loaded={map ? "true" : undefined}
      className={className}
    />
  );
}

/**
 * The base layer: every powiat, drawn once.
 *
 * Two layers over one source rather than one layer doing both. MapLibre's fill
 * layer draws its outline without joins, so shared borders come out ragged at
 * any real zoom; a separate line layer is the standard fix, and it is also
 * what lets the border keep its weight while the fill changes underneath it
 * (commit 84).
 */
function addBoundaryLayers(
  map: MapLibreMap,
  boundaries: PowiatFeatureCollection,
  styles: CSSStyleDeclaration,
) {
  if (boundaries.features.length === 0) return;

  const surface = styles.getPropertyValue("--card").trim() || "#1B2534";
  const border = styles.getPropertyValue("--border").trim() || "#2A3547";

  map.addSource("powiats", {
    type: "geojson",
    data: boundaries as never,
    // The TERYT code is the identity the whole backend is built around, and
    // MapLibre needs a stable feature id to address one powiat later.
    promoteId: "terytCode",
  });

  const severityColor = (level: 1 | 2 | 3) =>
    styles.getPropertyValue(`--dt-color-warning-${level}`).trim() || surface;

  map.addLayer({
    id: "powiat-fill",
    type: "fill",
    source: "powiats",
    paint: {
      // The one place outside the alert surfaces where IMGW's scale is
      // allowed (design.md §3): here it *is* severity, not decoration. It
      // never carries the meaning alone - the legend in commit 85 and the
      // popover in 86 name the level in words.
      "fill-color": [
        "match",
        ["coalesce", ["feature-state", "severity"], 0],
        3, severityColor(3),
        2, severityColor(2),
        1, severityColor(1),
        surface,
      ],
      "fill-opacity": [
        "case",
        ["boolean", ["to-boolean", ["coalesce", ["feature-state", "severity"], 0]], false],
        0.75,
        0.9,
      ],
    },
  });

  map.addLayer({
    id: "powiat-outline",
    type: "line",
    source: "powiats",
    paint: {
      "line-color": border,
      // Thin when zoomed out: 380 borders at a fixed width read as a grey mesh
      // rather than as a country.
      "line-width": ["interpolate", ["linear"], ["zoom"], 5, 0.4, 10, 1.2],
    },
  });
}

/**
 * Paints the powiats a warning covers, through feature state.
 *
 * Feature state rather than a filter or a rebuilt source: it changes what is
 * painted without touching the geometry, so a warning arriving live repaints
 * in place instead of dropping the viewport back to the whole country while
 * someone is looking at their own powiat.
 *
 * Every feature is written on each pass, including the ones with no warning.
 * State is sticky - a powiat left alone keeps whatever level it had when its
 * warning expired, which is the worst possible stale value to show.
 */
function applySeverity(
  map: MapLibreMap,
  boundaries: PowiatFeatureCollection,
  severityByTeryt: Record<string, WarningSeverityLevel>,
) {
  if (!map.getSource("powiats")) return;

  for (const feature of boundaries.features) {
    const terytCode = feature.properties.terytCode;
    map.setFeatureState(
      { source: "powiats", id: terytCode },
      { severity: Number(severityByTeryt[terytCode] ?? 0) },
    );
  }
}
