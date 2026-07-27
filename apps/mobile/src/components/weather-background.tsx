import { tokens } from "@weather-app/design-tokens";
import { resolveWeatherChannels } from "@weather-app/core";
import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import { View } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

type WeatherBackgroundProps = {
  /** WMO code from Open-Meteo, via the backend forecast endpoint. */
  weatherCode: number;
  temperatureCelsius: number;
  /** IANA zone of the displayed location, not of the viewer. */
  timeZone?: string;
  /** Injectable clock, so the render is deterministic in tests. */
  now?: Date;
  children?: ReactNode;
};

/**
 * The web hero's background, rebuilt from React Native primitives.
 *
 * Same three channels and the same numbers - both apps read `sky` and `veil`
 * from @weather-app/design-tokens, so the gradient cannot drift between them.
 * What differs is only how each is painted:
 *
 *  - sky:        a two-stop expo-linear-gradient, same as the CSS.
 *  - glow:       an SVG radial gradient. React Native has no radial-gradient
 *                background, and the glow is what stops the hero reading as a
 *                flat colour swatch, so it is worth an <Svg> layer.
 *  - phenomenon: a dark veil at the token's opacity. The CSS version also
 *                pushes contrast through backdrop-filter, which has no React
 *                Native equivalent - the ordering (drizzle lighter than rain,
 *                rain lighter than a thunderstorm) is what carries the meaning
 *                and that survives intact.
 */
export function WeatherBackground({
  weatherCode,
  temperatureCelsius,
  timeZone,
  now,
  children,
}: WeatherBackgroundProps) {
  const channels = resolveWeatherChannels({ weatherCode, temperatureCelsius, now, timeZone });
  const sky = tokens.sky[channels.timeOfDay];
  const veil = tokens.veil[channels.phenomenon];

  return (
    <View className="relative flex-1 overflow-hidden">
      <LinearGradient
        colors={[sky.a, sky.b]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      />

      <Svg
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        pointerEvents="none"
      >
        <Defs>
          <RadialGradient id="wb-glow-a" cx="50%" cy={sky.glowY} rx="120%" ry="70%">
            <Stop offset="0" stopColor={tokens.glow[channels.timeOfDay]} />
            <Stop offset="0.62" stopColor={tokens.glow[channels.timeOfDay]} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="wb-glow-b" cx="18%" cy="34%" rx="90%" ry="55%">
            <Stop offset="0" stopColor={sky.glowB} />
            <Stop offset="0.7" stopColor={sky.glowB} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#wb-glow-a)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#wb-glow-b)" />
      </Svg>

      {Number(veil.opacity) > 0 && (
        <LinearGradient
          colors={["rgba(10, 14, 20, 0.55)", "transparent", "rgba(8, 11, 16, 0.7)"]}
          locations={[0, 0.45, 1]}
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            opacity: Number(veil.opacity),
          }}
        />
      )}

      <View className="relative flex-1">{children}</View>
    </View>
  );
}
