"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import type { Map as MapLibreMap } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";

import type { PowiatFeatureCollection } from "@/lib/map/boundaries";
import { POLAND_BOUNDS, warningMapStyle } from "@/lib/map/style";

type WarningMapProps = {
  className?: string;
  /** Announced to assistive technology - the canvas itself says nothing. */
  label: string;
  /** Every powiat, fetched on the server (see lib/map/boundaries). */
  boundaries: PowiatFeatureCollection;
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
export function WarningMap({ className, label, boundaries }: WarningMapProps) {
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

  map.addLayer({
    id: "powiat-fill",
    type: "fill",
    source: "powiats",
    paint: { "fill-color": surface, "fill-opacity": 0.9 },
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
