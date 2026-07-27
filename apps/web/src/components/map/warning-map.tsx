"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import type { LngLat, Map as MapLibreMap } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";

import type { WarningSeverityLevel } from "@/components/alert-takeover";
import { PowiatPopover, type PowiatAlertSummary } from "@/components/map/powiat-popover";
import type { PowiatFeatureCollection } from "@/lib/map/geojson";
import { POLAND_BOUNDS, powiatFillPaint, warningMapStyle } from "@/lib/map/style";
import type { Locale } from "@weather-app/core";

type WarningMapProps = {
  className?: string;
  /** Announced to assistive technology - the canvas itself says nothing. */
  label: string;

  /** TERYT code -> the highest IMGW level in force there, if any. */
  severityByTeryt: Record<string, WarningSeverityLevel>;
  /** TERYT code -> the warnings covering it, for the popover. */
  alertsByTeryt: Record<string, PowiatAlertSummary[]>;
  locale: Locale;
  /** Opening frame, derived from the user's saved locations (lib/map/style). */
  initialBounds: [number, number, number, number];
};

type Selection = {
  terytCode: string;
  name: string;
  voivodeship: string;
  lngLat: LngLat;
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
export function WarningMap({
  className,
  label,
  severityByTeryt,
  alertsByTeryt,
  locale,
  initialBounds,
}: WarningMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [boundaries, setBoundaries] = useState<PowiatFeatureCollection | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  // Where the selected point currently sits on screen. Recomputed as the map
  // moves, so the card stays glued to its powiat while panning rather than
  // hovering over a fixed pixel.
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null);

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
        bounds: initialBounds,
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
        setMap(created);
      });

      created.on("click", "powiat-fill", (event) => {
        const feature = event.features?.[0];
        if (!feature) return;

        const properties = feature.properties as Selection;
        setSelection({
          terytCode: properties.terytCode,
          name: properties.name,
          voivodeship: properties.voivodeship,
          lngLat: event.lngLat,
        });
        setPoint({ x: event.point.x, y: event.point.y });
      });

      // Clicking bare background dismisses. Registered on the map rather than
      // the layer, and fires after the layer handler above, so a click that
      // landed on a powiat has already set its selection.
      created.on("click", (event) => {
        if (created?.queryRenderedFeatures(event.point, { layers: ["powiat-fill"] }).length === 0) {
          setSelection(null);
          setPoint(null);
        }
      });

      created.on("mouseenter", "powiat-fill", () => {
        if (created) created.getCanvas().style.cursor = "pointer";
      });
      created.on("mouseleave", "powiat-fill", () => {
        if (created) created.getCanvas().style.cursor = "";
      });
    })();

    return () => {
      disposed = true;
      created?.remove();
      setMap(null);
    };
    // `initialBounds` is the *opening* frame by definition: recreating the
    // map to honour a changed one would yank the viewport out from under
    // someone who had panned away from it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * The geometry is fetched by the browser rather than rendered into the page.
   *
   * It is 2.4MB and identical for everyone, so inlining it made every visit to
   * this page ship the whole country again - and threw away the backend's HTTP
   * caching (commit 81), which a browser cannot use for bytes it never asked
   * for. Fetched here it is downloaded once and revalidated with an ETag after
   * that.
   *
   * The cost is honest: the map paints a beat later than the page. That is the
   * right trade for not delaying everything else on the page by 2.4MB.
   */
  useEffect(() => {
    const controller = new AbortController();

    void fetch("/api/boundaries/geojson", { signal: controller.signal })
      .then((response) => response.json() as Promise<PowiatFeatureCollection>)
      .then(setBoundaries)
      .catch(() => {
        // An empty map is a visible failure; a thrown promise here would be an
        // invisible one.
      });

    return () => controller.abort();
  }, []);

  // Layers are added once both the map and its geometry exist - either can
  // arrive first, and neither is useful without the other.
  useEffect(() => {
    if (!map || !boundaries || map.getSource("powiats")) return;
    addBoundaryLayers(map, boundaries, getComputedStyle(document.documentElement));
  }, [map, boundaries]);

  // Severity is applied separately from the layers, and re-applied whenever it
  // changes. A warning arriving over the WebSocket must repaint the map, and
  // rebuilding the source to do it would drop the viewport back to Poland
  // while the user was looking at their own powiat.
  useEffect(() => {
    if (!map || !boundaries) return;
    applySeverity(map, boundaries, severityByTeryt);
  }, [map, boundaries, severityByTeryt]);

  // Kept in sync while the map moves, so the card stays glued to its powiat
  // while panning rather than hovering over a fixed pixel. The first position
  // comes from the click itself, which is why this effect only subscribes and
  // never sets state on its own.
  useEffect(() => {
    if (!map || !selection) return;

    const reposition = () => {
      const projected = map.project(selection.lngLat);
      setPoint({ x: projected.x, y: projected.y });
    };

    map.on("move", reposition);
    return () => {
      map.off("move", reposition);
    };
  }, [map, selection]);

  return (
    <div className="relative size-full">
    <div
      ref={container}
      role="img"
      aria-label={label}
      data-loaded={map ? "true" : undefined}
      className={className}
    />
      {selection && point && (
        <PowiatPopover
          name={selection.name}
          voivodeship={selection.voivodeship}
          alerts={alertsByTeryt[selection.terytCode] ?? []}
          locale={locale}
          x={point.x}
          y={point.y}
          onClose={() => {
            setSelection(null);
            setPoint(null);
          }}
        />
      )}
    </div>
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
    // The one place outside the alert surfaces where IMGW's scale is allowed
    // (design.md §3): here the colour *is* the severity rather than standing
    // in for it. It never carries the meaning alone - the legend names each
    // level in words, and so does the popover.
    paint: powiatFillPaint(surface, severityColor) as never,
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
