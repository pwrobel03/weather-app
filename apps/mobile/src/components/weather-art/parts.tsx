import { Circle, G, Line, Mask, Path, Rect } from "react-native-svg";

import { useGradientId } from "./gradients";

/**
 * Primitive shapes the weather icons are composed from - the react-native-svg
 * twin of apps/web/src/components/weather-art/parts.tsx.
 *
 * Same 64x64 viewBox and same numbers, deliberately: the geometry is the
 * design, and an icon that differs between the two clients is the most visible
 * thing that could differ at all. When a shape changes, both files change.
 */

/** Puffy cloud built from overlapping circles plus a rounded base. */
export function Cloud({
  variant = "light",
  x = 0,
  y = 0,
  scale = 1,
  opacity = 1,
}: {
  variant?: "light" | "dark";
  x?: number;
  y?: number;
  scale?: number;
  opacity?: number;
}) {
  const fill = useGradientId(`cloud-${variant}`);

  return (
    <G transform={`translate(${x} ${y}) scale(${scale})`} opacity={opacity}>
      <G fill={fill}>
        <Circle cx="24" cy="30" r="11" />
        <Circle cx="37" cy="27" r="13.5" />
        <Circle cx="46" cy="34" r="9.5" />
        <Rect x="20" y="33" width="30" height="11" rx="5.5" />
      </G>
    </G>
  );
}

export function Sun({ cx = 32, cy = 26, r = 11 }: { cx?: number; cy?: number; r?: number }) {
  const fill = useGradientId("sun");
  const rays = Array.from({ length: 8 }, (_, index) => {
    const angle = (index * Math.PI) / 4;
    const inner = r + 3.5;
    const outer = r + 8;
    return (
      <Line
        key={index}
        x1={cx + Math.cos(angle) * inner}
        y1={cy + Math.sin(angle) * inner}
        x2={cx + Math.cos(angle) * outer}
        y2={cy + Math.sin(angle) * outer}
      />
    );
  });

  return (
    <G>
      <G stroke={fill} strokeWidth="3.4" strokeLinecap="round">
        {rays}
      </G>
      <Circle cx={cx} cy={cy} r={r} fill={fill} />
    </G>
  );
}

export function Moon({ cx = 32, cy = 27, r = 12 }: { cx?: number; cy?: number; r?: number }) {
  // Crescent by subtraction: a circle with a second circle masked out reads as
  // a moon at any size, where a hand-drawn crescent path distorts when scaled.
  const fill = useGradientId("moon");
  const maskId = `wa-moon-mask-${cx}-${cy}-${r}`;

  return (
    <G>
      <Mask id={maskId}>
        <Rect x="0" y="0" width="64" height="64" fill="white" />
        <Circle cx={cx + r * 0.55} cy={cy - r * 0.42} r={r * 0.92} fill="black" />
      </Mask>
      <Circle cx={cx} cy={cy} r={r} fill={fill} mask={`url(#${maskId})`} />
    </G>
  );
}

export function Bolt() {
  return <Path d="M33.5 36 L25 50 L31.5 50 L28.5 60 L39.5 45.5 L32.5 45.5 L36 36 Z" fill={useGradientId("bolt")} />;
}

/** Falling drops. `heavy` slants them, which is how rain reads as driven. */
export function Drops({ count = 3, heavy = false }: { count?: number; heavy?: boolean }) {
  const stroke = useGradientId("rain");
  const positions = Array.from({ length: count }, (_, index) => 23 + index * (18 / count));

  return (
    <G stroke={stroke} strokeWidth={heavy ? 3.4 : 2.8} strokeLinecap="round">
      {positions.map((x, index) => (
        <Line key={x} x1={x} y1={47 + (index % 2) * 2} x2={heavy ? x - 4 : x} y2={56 + (index % 2) * 2} />
      ))}
    </G>
  );
}

export function Flakes({ count = 3 }: { count?: number }) {
  const fill = useGradientId("snow");
  const positions = Array.from({ length: count }, (_, index) => 24 + index * (16 / count));

  return (
    <G fill={fill}>
      {positions.map((x, index) => (
        <Circle key={x} cx={x} cy={50 + (index % 2) * 4} r="2.6" />
      ))}
    </G>
  );
}

export function Hailstones() {
  return (
    <G fill={useGradientId("snow")}>
      <Circle cx="27" cy="51" r="2.8" />
      <Circle cx="38" cy="55" r="2.8" />
    </G>
  );
}

export function FogLines() {
  return (
    <G stroke={useGradientId("cloud-dark")} strokeWidth="3.2" strokeLinecap="round" opacity="0.85">
      <Line x1="18" y1="47" x2="46" y2="47" />
      <Line x1="22" y1="54" x2="42" y2="54" />
    </G>
  );
}
