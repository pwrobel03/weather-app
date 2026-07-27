import { tokens } from "@weather-app/design-tokens";

import { adjust, mix } from "./color";
import { season, seasonBlend, SEASON_TILT, type Season, type SeasonBlend } from "./season";
import {
  phenomenonFromWeatherCode,
  temperatureSaturation,
  timeOfDay,
  timeOfDayBlend,
  type Phenomenon,
  type TimeOfDay,
  type TimeOfDayBlend,
} from "./channels";

/**
 * The background, composed from independent channels (markdown/design.md).
 *
 * The rule this exists to enforce: **channels are developed separately and
 * combinations fall out on their own.** Four times of day x four seasons x
 * five phenomena is eighty variants, which is not a set anyone can author or
 * maintain by hand - so nothing here may branch on a *combination*. Each
 * channel contributes one adjustment to one dimension, and the result is
 * whatever those adjustments multiply out to.
 *
 * It returns concrete values rather than class names or data attributes. That
 * is what the previous version got wrong for the purposes of Faza 9: the CSS
 * held one block per time of day and one per phenomenon, so the composition
 * lived in a stylesheet where nothing could compute it and nothing could test
 * it - and where apps/mobile, which paints into a canvas, could not read it at
 * all.
 */
export type BackgroundInput = {
  /** WMO code from Open-Meteo, via the backend forecast endpoint. */
  weatherCode: number;
  temperatureCelsius: number;
  /** IANA zone of the displayed location, not of the viewer. */
  timeZone?: string;
  /** Injectable clock, so a render is deterministic in tests. */
  now?: Date;
};

export type BackgroundComposition = {
  /** Which bucket each channel resolved to, for debugging and for tests. */
  channels: {
    timeOfDay: TimeOfDay;
    phenomenon: Phenomenon;
    saturation: number;
    blend: TimeOfDayBlend;
    season: Season;
  };
  /** Vertical gradient, top to bottom. */
  sky: { from: string; to: string };
  /** Primary radial glow: its colour and how far down the panel it sits. */
  glow: { color: string; y: string; secondary: string };
  /** Dark veil over the sky, carrying the phenomenon's weight. */
  veil: { opacity: number; contrast: number };
};

export function composeBackground(input: BackgroundInput): BackgroundComposition {
  const now = input.now ?? new Date();
  const resolvedTimeOfDay = timeOfDay(now, input.timeZone);
  const phenomenon = phenomenonFromWeatherCode(input.weatherCode);
  const saturation = temperatureSaturation(input.temperatureCelsius);

  // The sky is a blend between two anchors rather than a lookup on the current
  // bucket, so it moves through the day instead of switching at 17:00.
  const blend = timeOfDayBlend(now, input.timeZone);
  const from = tokens.sky[blend.from];
  const to = tokens.sky[blend.to];
  const veil = tokens.veil[phenomenon];

  // Season contributes a hue tilt and a small chroma nudge, blended between
  // its own anchors exactly as the time of day is.
  const seasons = seasonBlend(now, input.timeZone);
  const tilt = blendTilt(seasons);

  // Two channels multiply into one chroma value here, which is the whole point
  // of the architecture: neither knows the other exists, and the combination
  // needs no case of its own.
  const chromaScale = saturation * tilt.chromaScale;

  return {
    channels: {
      timeOfDay: resolvedTimeOfDay,
      phenomenon,
      saturation,
      blend,
      season: season(now, input.timeZone),
    },
    sky: {
      from: adjust(mix(from.a, to.a, blend.t), { chromaScale, hueShift: tilt.hueShift }),
      to: adjust(mix(from.b, to.b, blend.t), { chromaScale, hueShift: tilt.hueShift }),
    },
    glow: {
      color: mixRgba(tokens.glow[blend.from], tokens.glow[blend.to], blend.t),
      // Percentages, so the glow travels down the panel as the day passes
      // rather than teleporting between four fixed heights.
      y: `${mixNumber(percent(from.glowY), percent(to.glowY), blend.t).toFixed(1)}%`,
      secondary: mixRgba(from.glowB, to.glowB, blend.t),
    },
    veil: { opacity: Number(veil.opacity), contrast: Number(veil.contrast) },
  };
}

/** The season tilt at a point between two season anchors. */
function blendTilt(blend: SeasonBlend): { hueShift: number; chromaScale: number } {
  const from = SEASON_TILT[blend.from];
  const to = SEASON_TILT[blend.to];

  return {
    hueShift: mixNumber(from.hueShift, to.hueShift, blend.t),
    chromaScale: mixNumber(from.chromaScale, to.chromaScale, blend.t),
  };
}

/**
 * Blends two `rgba(...)` strings component-wise.
 *
 * The glows are authored as rgba rather than hex because their alpha is part
 * of the design, and OKLCH has nothing to say about alpha - so these
 * interpolate in plain sRGB. Acceptable here and nowhere else: the glow colours
 * of two adjacent times of day are close in hue, so the straight-line path
 * does not pass through the grey that makes sRGB interpolation a bad default.
 */
function mixRgba(from: string, to: string, t: number): string {
  const a = parseRgba(from);
  const b = parseRgba(to);
  if (!a || !b) return t < 0.5 ? from : to;

  const channel = (index: number) => Math.round(mixNumber(a[index]!, b[index]!, t));

  return `rgba(${channel(0)}, ${channel(1)}, ${channel(2)}, ${mixNumber(a[3]!, b[3]!, t).toFixed(3)})`;
}

function parseRgba(value: string): [number, number, number, number] | null {
  const match = value.match(/rgba?\(([^)]+)\)/);
  if (!match) return null;

  const parts = match[1]!.split(",").map((part) => Number(part.trim()));
  if (parts.length < 3 || parts.some(Number.isNaN)) return null;

  return [parts[0]!, parts[1]!, parts[2]!, parts[3] ?? 1];
}

function percent(value: string): number {
  return Number(value.replace("%", ""));
}

function mixNumber(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}
