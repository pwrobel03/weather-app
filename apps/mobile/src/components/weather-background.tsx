import {
  Canvas,
  ColorMatrix,
  Group,
  Paint,
  Circle as SkCircle,
  LinearGradient as SkLinearGradient,
  RadialGradient as SkRadialGradient,
  Rect as SkRect,
  vec,
} from "@shopify/react-native-skia";
import { composeBackground, type BackgroundTexture } from "@weather-app/core";
import type { ReactNode } from "react";
import { useState } from "react";
import { StyleSheet, View, type LayoutChangeEvent } from "react-native";

import { StormFlash } from "./storm-flash";

type WeatherBackgroundProps = {
  /** WMO code from Open-Meteo, via the backend forecast endpoint. */
  weatherCode: number;
  temperatureCelsius: number;
  /** Drives how far the falling texture leans. Absent means still air. */
  windSpeedKmh?: number;
  /** IANA zone of the displayed location, not of the viewer. */
  timeZone?: string;
  /** Injectable clock, so the render is deterministic in tests. */
  now?: Date;
  children?: ReactNode;
};

/**
 * The web hero's background, painted with Skia.
 *
 * Skia rather than expo-linear-gradient (follow-up.md point 11), for a reason
 * visible in one line below: `ColorMatrix`. The phenomenon channel carries a
 * contrast value, and React Native has no equivalent of a CSS filter - the
 * previous version simply dropped it and approximated the difference with
 * opacity. With a colour matrix this computes the same thing the web does
 * instead of imitating it.
 *
 * The rest follows from the same choice: the glow is a real radial gradient
 * rather than an SVG stand-in, and the storm flash runs on the UI thread
 * instead of through the JS bridge.
 *
 * The cost, stated where it hurts: Skia is a native module, so this app can no
 * longer run in Expo Go and needs a development build.
 */
export function WeatherBackground({
  weatherCode,
  temperatureCelsius,
  windSpeedKmh,
  timeZone,
  now,
  children,
}: WeatherBackgroundProps) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const { sky, glow, veil, texture, storm } = composeBackground({
    weatherCode,
    temperatureCelsius,
    windSpeedKmh,
    now,
    timeZone,
  });

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    // Compared before setting: onLayout fires on every re-render, and an
    // unconditional setState here is an infinite render loop.
    setSize((current) =>
      current.width === width && current.height === height ? current : { width, height },
    );
  };

  const { width, height } = size;
  const glowY = (Number(glow.y.replace("%", "")) / 100) * height;

  return (
    <View className="relative flex-1 overflow-hidden" onLayout={onLayout}>
      {width > 0 && height > 0 && (
        <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
          <SkRect x={0} y={0} width={width} height={height}>
            <SkLinearGradient
              start={vec(width / 2, 0)}
              end={vec(width / 2, height)}
              colors={[sky.from, sky.to]}
            />
          </SkRect>

          {/* Primary glow, riding down the panel as the day passes. */}
          <SkRect x={0} y={0} width={width} height={height}>
            <SkRadialGradient
              c={vec(width / 2, glowY)}
              r={Math.max(width, height) * 0.85}
              colors={[glow.color, "transparent"]}
            />
          </SkRect>

          <SkRect x={0} y={0} width={width} height={height}>
            <SkRadialGradient
              c={vec(width * 0.18, height * 0.34)}
              r={Math.max(width, height) * 0.7}
              colors={[glow.secondary, "transparent"]}
            />
          </SkRect>

          {veil.opacity > 0 && (
            <Group
              opacity={veil.opacity}
              // The contrast the previous version had to drop. This is the
              // line that justifies the whole dependency.
              layer={
                <Paint>
                  <ColorMatrix matrix={contrastMatrix(veil.contrast)} />
                </Paint>
              }
            >
              <SkRect x={0} y={0} width={width} height={height}>
                <SkLinearGradient
                  start={vec(width / 2, 0)}
                  end={vec(width / 2, height)}
                  colors={["rgba(10, 14, 20, 0.55)", "rgba(0,0,0,0)", "rgba(8, 11, 16, 0.7)"]}
                  positions={[0, 0.45, 1]}
                />
              </SkRect>
            </Group>
          )}

          <Texture texture={texture} width={width} height={height} />

          {storm.active && <StormFlash width={width} height={height} intensity={storm.intensity} />}
        </Canvas>
      )}

      <View className="relative flex-1">{children}</View>
    </View>
  );
}

/**
 * The falling texture: streaks for water, round marks for snow and hail.
 *
 * A fixed lattice rotated by the wind angle, not particles - design.md
 * rejected a particle layer, and the reasoning holds harder on a phone:
 * thousands of moving sprites behind a screen whose job is to stay readable is
 * a lot of battery spent making text harder to read.
 */
function Texture({
  texture,
  width,
  height,
}: {
  texture: BackgroundTexture;
  width: number;
  height: number;
}) {
  // Fog has the heaviest veil in the set and nothing falling; giving it marks
  // is the single easiest way to make it read as rain.
  if (texture.density === 0 || texture.kind === "none" || texture.kind === "fog") return null;

  const round = texture.kind === "snow" || texture.kind === "hail";
  const spacing = round ? (texture.kind === "hail" ? 58 : 44) : texture.kind === "drizzle" ? 22 : 34;
  // Overdrawn past the bounds, so rotating never exposes an uncovered corner.
  const margin = Math.max(width, height) * 0.4;

  const marks: { x: number; y: number }[] = [];
  for (let y = -margin; y < height + margin; y += spacing) {
    // Every other row is offset, or the lattice reads as a grid rather than as
    // weather.
    const offset = (Math.round(y / spacing) % 2) * (spacing / 2);
    for (let x = -margin; x < width + margin; x += spacing) {
      marks.push({ x: x + offset, y });
    }
  }

  const color = round ? "rgba(238, 246, 255, 0.85)" : "rgba(214, 233, 252, 0.62)";
  const length = texture.kind === "drizzle" ? 7 : 15;

  return (
    <Group
      opacity={texture.density}
      transform={[{ rotate: (texture.angle * Math.PI) / 180 }]}
      origin={vec(width / 2, height / 2)}
    >
      {marks.map((mark, index) =>
        round ? (
          <SkCircle
            key={index}
            cx={mark.x}
            cy={mark.y}
            r={texture.kind === "hail" ? 2 : 1.6}
            color={color}
          />
        ) : (
          <SkRect key={index} x={mark.x} y={mark.y} width={1.5} height={length} color={color} />
        ),
      )}
    </Group>
  );
}

/**
 * The 5x4 colour matrix for a contrast adjustment, matching CSS `contrast()`.
 *
 * Contrast pivots around mid-grey: each channel is scaled and then shifted
 * back by half of what it moved, or the image simply gets brighter instead of
 * more contrasted.
 */
export function contrastMatrix(amount: number): number[] {
  const shift = (1 - amount) / 2;

  return [
    amount, 0, 0, 0, shift,
    0, amount, 0, 0, shift,
    0, 0, amount, 0, shift,
    0, 0, 0, 1, 0,
  ];
}
