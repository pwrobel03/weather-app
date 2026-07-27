/**
 * Which shapes a weather icon is made of, for a given WMO code.
 *
 * The geometry itself cannot be shared - apps/web draws into the DOM and
 * apps/mobile into react-native-svg, and those are different renderers with
 * different element names. The *decision* can be, and this is it: the two
 * clients may draw a cloud with their own primitives, but they must never
 * disagree about whether code 82 shows one.
 *
 * Deliberately more literal than the background's phenomenon channel, which
 * buckets into eight coarse groups. design.md assigns literalness to the icon:
 * light rain and violent showers get different icons even though the gradient
 * treats both as simply "rain".
 */
export type WeatherScenePart =
  | { part: "sun"; cx?: number; cy?: number; r?: number }
  | { part: "moon"; cx?: number; cy?: number; r?: number }
  | { part: "cloud"; variant?: "light" | "dark"; x?: number; y?: number; scale?: number }
  | { part: "drops"; count: number; heavy?: boolean }
  | { part: "flakes"; count: number }
  | { part: "fogLines" }
  | { part: "bolt" }
  | { part: "hailstones" };

export function weatherScene(code: number, isNight: boolean): WeatherScenePart[] {
  // Clear
  if (code === 0) {
    return [isNight ? { part: "moon" } : { part: "sun" }];
  }

  // Mainly clear / partly cloudy - luminary peeking from behind the cloud.
  if (code === 1 || code === 2) {
    return [
      isNight ? { part: "moon", cx: 41, cy: 20, r: 9 } : { part: "sun", cx: 42, cy: 20, r: 8.5 },
      { part: "cloud", x: -4, y: 4, scale: 0.92 },
    ];
  }

  // Overcast
  if (code === 3) {
    return [{ part: "cloud", y: 2 }];
  }

  // Fog
  if (code === 45 || code === 48) {
    return [{ part: "cloud", y: -4, scale: 0.9, variant: "light" }, { part: "fogLines" }];
  }

  // Drizzle, including freezing drizzle
  if (code >= 51 && code <= 57) {
    return [{ part: "cloud", y: -4 }, { part: "drops", count: 4 }];
  }

  // Rain: slight / moderate, and slight / moderate showers
  if (code === 61 || code === 63 || code === 80 || code === 81) {
    return [{ part: "cloud", y: -4, variant: "dark" }, { part: "drops", count: 3 }];
  }

  // Rain: heavy, freezing rain, violent showers
  if (code === 65 || code === 66 || code === 67 || code === 82) {
    return [{ part: "cloud", y: -4, variant: "dark" }, { part: "drops", count: 5, heavy: true }];
  }

  // Snow, including grains and showers
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) {
    return [
      { part: "cloud", y: -4 },
      { part: "flakes", count: code === 75 || code === 86 ? 5 : 3 },
    ];
  }

  // Thunderstorm
  if (code === 95) {
    return [{ part: "cloud", y: -6, variant: "dark" }, { part: "bolt" }];
  }

  // Thunderstorm with hail
  if (code === 96 || code === 99) {
    return [{ part: "cloud", y: -6, variant: "dark" }, { part: "bolt" }, { part: "hailstones" }];
  }

  return [{ part: "cloud", y: 2 }];
}
