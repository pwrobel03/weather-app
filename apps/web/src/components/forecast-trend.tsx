"use client";

import {
  areaPath,
  barsFor,
  extentOf,
  formatHourMinute,
  indexAtX,
  linePath,
  niceTicks,
  nowAsNaiveIsoTimestamp,
  pointsFor,
  scaleY,
  type Box,
  type HourlyForecastEntry,
} from "@weather-app/core";
import { useState } from "react";

const HOURS = 24;

/**
 * Where the next day is going, as two plots rather than one.
 *
 * Temperature and chance of rain do not share a scale, and putting them on one
 * chart with two axes is the mistake that makes every crossing look like an
 * event - the point where the lines meet is an artefact of where the axes were
 * put, not something the weather did. Two stacked plots over the same hours
 * cost one extra heading and say only true things.
 *
 * The hourly strip above already answers "what is it doing at four" - this
 * answers the question the strip is bad at, which is the shape of the day.
 */
export function ForecastTrend({
  entries,
  now = new Date(),
}: {
  entries: HourlyForecastEntry[];
  now?: Date;
}) {
  const [hovered, setHovered] = useState<number | null>(null);

  const nowLocal = nowAsNaiveIsoTimestamp(now);
  const upcoming = entries.filter((entry) => entry.time >= nowLocal).slice(0, HOURS);

  if (upcoming.length < 2) return null;

  const temperatures = upcoming.map((entry) => entry.temperatureCelsius);
  const chances = upcoming.map((entry) => entry.precipitationProbabilityPercent);
  const active = hovered === null ? null : upcoming[hovered];

  return (
    <figure className="m-0 flex flex-col gap-4">
      <Plot
        label="Temperatura"
        unit="°C"
        values={temperatures}
        entries={upcoming}
        hovered={hovered}
        onHover={setHovered}
        kind="line"
      />
      <Plot
        label="Szansa opadu"
        unit="%"
        values={chances}
        entries={upcoming}
        hovered={hovered}
        onHover={setHovered}
        kind="bars"
      />

      {/* One caption for both plots: they share an x axis, so the hour being
          read is the same fact twice. */}
      <figcaption className="min-h-5 text-xs text-muted-foreground tabular-nums">
        {active
          ? `${formatHourMinute(active.time)} · ${Math.round(active.temperatureCelsius)}°C · ${active.precipitationProbabilityPercent}%`
          : `Najbliższe ${upcoming.length} h`}
      </figcaption>
    </figure>
  );
}

const BOX: Box = {
  width: 640,
  height: 120,
  // Left room for the axis labels; bottom for the hours under the plot.
  padding: { top: 12, right: 8, bottom: 18, left: 28 },
};

function Plot({
  label,
  unit,
  values,
  entries,
  hovered,
  onHover,
  kind,
}: {
  label: string;
  unit: string;
  values: number[];
  entries: HourlyForecastEntry[];
  hovered: number | null;
  onHover: (index: number | null | ((current: number | null) => number | null)) => void;
  kind: "line" | "bars";
}) {
  // Rain is an amount, so its axis starts at zero; temperature is a position on
  // a scale that has no floor worth drawing.
  const extent = extentOf(values, { includeZero: kind === "bars" });
  const points = pointsFor(values, extent, BOX);
  const bars = barsFor(values, extent, BOX);
  const ticks = niceTicks(extent, 2);
  const floor = BOX.height - BOX.padding.bottom;

  return (
    <div className="flex flex-col gap-1">
      <p className="text-[0.8125rem] font-semibold tracking-[0.02em] text-muted-foreground">
        {label} <span className="font-normal">({unit})</span>
      </p>

      <svg
        viewBox={`0 0 ${BOX.width} ${BOX.height}`}
        className="h-[120px] w-full touch-none"
        // Focusable and driven by the arrow keys, because the crosshair is the
        // only way to read an individual hour off this chart and a pointer is
        // not the only way people use a browser. The slider role is what a
        // screen reader already knows how to narrate stepping through a range.
        tabIndex={0}
        role="slider"
        aria-label={`${label} na najbliższe ${values.length} godzin`}
        aria-valuemin={0}
        aria-valuemax={values.length - 1}
        aria-valuenow={hovered ?? 0}
        aria-valuetext={
          hovered === null
            ? undefined
            : `${formatHourMinute(entries[hovered]!.time)}: ${Math.round(values[hovered]!)}${unit}`
        }
        onKeyDown={(event) => {
          const step =
            event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
          if (step === 0) {
            // Escape gives the keyboard a way back out of the readout, the
            // same exit a pointer gets by leaving the chart.
            if (event.key === "Escape") onHover(null);
            return;
          }

          event.preventDefault();
          const next = (hovered ?? 0) + step;
          onHover(Math.min(Math.max(next, 0), values.length - 1));
        }}
        onFocus={() => onHover((current) => current ?? 0)}
        onBlur={() => onHover(null)}
        onPointerMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          // Into the viewBox's own coordinates - the SVG is scaled to its
          // container, so client pixels are not chart pixels.
          const x = ((event.clientX - rect.left) / rect.width) * BOX.width;
          onHover(indexAtX(x, values.length, BOX));
        }}
        onPointerLeave={() => onHover(null)}
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={BOX.padding.left}
              x2={BOX.width - BOX.padding.right}
              y1={scaleY(tick, extent, BOX)}
              y2={scaleY(tick, extent, BOX)}
              className="stroke-border"
              strokeWidth={1}
            />
            <text
              x={0}
              y={scaleY(tick, extent, BOX) + 3}
              className="fill-muted-foreground text-[9px] tabular-nums"
            >
              {tick}
            </text>
          </g>
        ))}

        {kind === "line" ? (
          <>
            <path d={areaPath(points, BOX)} className="fill-sky-500/12" />
            <path
              d={linePath(points)}
              fill="none"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="stroke-sky-500"
            />
          </>
        ) : (
          bars.map((bar, index) => (
            <rect
              key={index}
              x={bar.x}
              y={bar.y}
              width={bar.width}
              height={bar.height}
              rx={2}
              className={index === hovered ? "fill-sky-500" : "fill-sky-500/45"}
            />
          ))
        )}

        {hovered !== null && points[hovered] && (
          <g>
            <line
              x1={points[hovered]!.x}
              x2={points[hovered]!.x}
              y1={BOX.padding.top}
              y2={floor}
              className="stroke-foreground/25"
              strokeWidth={1}
            />
            {kind === "line" && (
              // A ring in the surface colour, so the marker reads as sitting on
              // the line rather than as a hole punched through it.
              <circle
                cx={points[hovered]!.x}
                cy={points[hovered]!.y}
                r={4}
                strokeWidth={2}
                className="fill-sky-500 stroke-background"
              />
            )}
          </g>
        )}

        {/* Hours under the plot, every sixth: one per hour collides at this
            width, and the reader needs the shape, not a timetable. */}
        {entries.map((entry, index) =>
          index % 6 === 0 ? (
            <text
              key={entry.time}
              x={points[index]!.x}
              y={BOX.height - 4}
              textAnchor="middle"
              className="fill-muted-foreground text-[9px] tabular-nums"
            >
              {formatHourMinute(entry.time)}
            </text>
          ) : null,
        )}
      </svg>
    </div>
  );
}
