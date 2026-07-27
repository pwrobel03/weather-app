import { weatherScene, type TimeOfDay, type WeatherScenePart } from "@weather-app/core";
import { useId } from "react";
import { View } from "react-native";
import Svg from "react-native-svg";

import { WeatherArtGradients } from "./gradients";
import { Bolt, Cloud, Drops, Flakes, FogLines, Hailstones, Moon, Sun } from "./parts";

type WeatherArtProps = {
  /** WMO code from Open-Meteo. */
  code: number;
  timeOfDay: TimeOfDay;
  size?: number;
  /** Accessible name. Omit for decorative use next to a text label. */
  title?: string;
};

/**
 * The web icon, drawn with react-native-svg.
 *
 * Two things differ from apps/web, both platform-forced:
 *
 * The soft contact shadow is a native shadow on the wrapping View rather than
 * an feDropShadow filter. react-native-svg's filter support is partial and
 * varies by platform, and a shadow that renders on iOS but not Android is
 * worse than one drawn by the platform on both.
 *
 * The gradient defs travel with each icon instead of living once at the root -
 * see the note in ./gradients on why the ids must be per-instance.
 */
export function WeatherArt({ code, timeOfDay, size = 160, title }: WeatherArtProps) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");

  return (
    <View
      accessible={Boolean(title)}
      accessibilityRole={title ? "image" : undefined}
      accessibilityLabel={title}
      style={{
        shadowColor: "#0B0E14",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.28,
        shadowRadius: 12,
        elevation: 6,
      }}
    >
      <Svg viewBox="0 0 64 64" width={size} height={size}>
        <WeatherArtGradients id={id}>
          {weatherScene(code, timeOfDay === "night").map((item, index) => (
            <Part key={index} item={item} />
          ))}
        </WeatherArtGradients>
      </Svg>
    </View>
  );
}

function Part({ item }: { item: WeatherScenePart }) {
  switch (item.part) {
    case "sun":
      return <Sun cx={item.cx} cy={item.cy} r={item.r} />;
    case "moon":
      return <Moon cx={item.cx} cy={item.cy} r={item.r} />;
    case "cloud":
      return <Cloud variant={item.variant} x={item.x} y={item.y} scale={item.scale} />;
    case "drops":
      return <Drops count={item.count} heavy={item.heavy} />;
    case "flakes":
      return <Flakes count={item.count} />;
    case "fogLines":
      return <FogLines />;
    case "bolt":
      return <Bolt />;
    case "hailstones":
      return <Hailstones />;
  }
}
