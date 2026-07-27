import { tokens } from "@weather-app/design-tokens";

import { adjust } from "./color";
import {
  phenomenonFromWeatherCode,
  temperatureSaturation,
  timeOfDay,
  type Phenomenon,
  type TimeOfDay,
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
  channels: { timeOfDay: TimeOfDay; phenomenon: Phenomenon; saturation: number };
  /** Vertical gradient, top to bottom. */
  sky: { from: string; to: string };
  /** Primary radial glow: its colour and how far down the panel it sits. */
  glow: { color: string; y: string; secondary: string };
  /** Dark veil over the sky, carrying the phenomenon's weight. */
  veil: { opacity: number; contrast: number };
};

export function composeBackground(input: BackgroundInput): BackgroundComposition {
  const resolvedTimeOfDay = timeOfDay(input.now ?? new Date(), input.timeZone);
  const phenomenon = phenomenonFromWeatherCode(input.weatherCode);
  const saturation = temperatureSaturation(input.temperatureCelsius);

  const sky = tokens.sky[resolvedTimeOfDay];
  const veil = tokens.veil[phenomenon];

  // Temperature is a chroma scale rather than a CSS `saturate` filter. The
  // filter applied to the whole layer, so it dragged the glow and the veil
  // with it; as a channel it belongs to the sky alone.
  const chromaScale = saturation;

  return {
    channels: { timeOfDay: resolvedTimeOfDay, phenomenon, saturation },
    sky: {
      from: adjust(sky.a, { chromaScale }),
      to: adjust(sky.b, { chromaScale }),
    },
    glow: {
      color: tokens.glow[resolvedTimeOfDay],
      y: sky.glowY,
      secondary: sky.glowB,
    },
    veil: { opacity: Number(veil.opacity), contrast: Number(veil.contrast) },
  };
}
