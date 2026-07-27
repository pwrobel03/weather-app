"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import type { Map as MapLibreMap } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";

import { POLAND_BOUNDS, warningMapStyle } from "@/lib/map/style";

type WarningMapProps = {
  className?: string;
  /** Announced to assistive technology - the canvas itself says nothing. */
  label: string;
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
export function WarningMap({ className, label }: WarningMapProps) {
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
        if (!disposed) setMap(created);
      });
    })();

    return () => {
      disposed = true;
      created?.remove();
      setMap(null);
    };
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
