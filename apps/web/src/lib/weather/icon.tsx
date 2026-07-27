import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudHail,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudRainWind,
  CloudSnow,
  CloudSun,
  Moon,
  Snowflake,
  Sun,
  Sunrise,
  Sunset,
  type LucideProps,
} from "lucide-react";
import type { ReactElement } from "react";

import type { TimeOfDay } from "./channels";

/**
 * Maps an Open-Meteo WMO weather code to a Lucide icon element.
 *
 * Unlike the background's phenomenon channel (channels.ts, 8 coarse
 * buckets), this is deliberately fine-grained: design.md assigns literalness
 * to the icon, not the background - "light rain" and "violent showers" get
 * different icons even though both are just "rain" to the gradient.
 *
 * Returns a rendered element (not a component reference) so callers never
 * hold a dynamically-chosen component in a variable and render it as a JSX
 * tag - the React Compiler flags that pattern (`static-components`) because
 * it can't verify the reference is stable across renders.
 */
export function weatherIcon(code: number, timeOfDay: TimeOfDay, props?: LucideProps): ReactElement {
  const isNight = timeOfDay === "night";

  switch (code) {
    case 0: // clear sky
      if (timeOfDay === "dawn") return <Sunrise {...props} />;
      if (timeOfDay === "dusk") return <Sunset {...props} />;
      return isNight ? <Moon {...props} /> : <Sun {...props} />;
    case 1: // mainly clear
    case 2: // partly cloudy
      return isNight ? <CloudMoon {...props} /> : <CloudSun {...props} />;
    case 3: // overcast
      return <Cloud {...props} />;
    case 45:
    case 48: // fog, depositing rime fog
      return <CloudFog {...props} />;
    case 51:
    case 53:
    case 55: // drizzle: light/moderate/dense
    case 56:
    case 57: // freezing drizzle: light/dense
      return <CloudDrizzle {...props} />;
    case 61:
    case 63: // rain: slight/moderate
    case 80:
    case 81: // rain showers: slight/moderate
      return <CloudRain {...props} />;
    case 65: // rain: heavy
    case 66:
    case 67: // freezing rain: light/heavy
    case 82: // rain showers: violent
      return <CloudRainWind {...props} />;
    case 71:
    case 73: // snow fall: slight/moderate
    case 77: // snow grains
      return <CloudSnow {...props} />;
    case 75: // snow fall: heavy
    case 85:
    case 86: // snow showers: slight/heavy
      return <Snowflake {...props} />;
    case 95: // thunderstorm: slight or moderate
      return <CloudLightning {...props} />;
    case 96:
    case 99: // thunderstorm with slight/heavy hail
      return <CloudHail {...props} />;
    default:
      return <Cloud {...props} />;
  }
}
