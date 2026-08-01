/**
 * Primitive shapes the weather icons are composed from.
 *
 * Built from parts rather than one hand-drawn file per WMO code: there are
 * ~20 codes but only about seven distinct things to draw. Composition keeps
 * the set consistent - every cloud in the app is literally the same cloud -
 * and means a new state is an arrangement, not a new drawing.
 *
 * All parts live in a 64x64 viewBox.
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
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} opacity={opacity}>
      <g fill={`url(#wa-cloud-${variant})`}>
        <circle cx="24" cy="30" r="11" />
        <circle cx="37" cy="27" r="13.5" />
        <circle cx="46" cy="34" r="9.5" />
        <rect x="20" y="33" width="30" height="11" rx="5.5" />
      </g>
    </g>
  );
}

export function Sun({ cx = 32, cy = 26, r = 11 }: { cx?: number; cy?: number; r?: number }) {
  const rays = Array.from({ length: 8 }, (_, index) => {
    const angle = (index * Math.PI) / 4;
    const inner = r + 3.5;
    const outer = r + 8;
    return (
      <line
        key={index}
        x1={cx + Math.cos(angle) * inner}
        y1={cy + Math.sin(angle) * inner}
        x2={cx + Math.cos(angle) * outer}
        y2={cy + Math.sin(angle) * outer}
      />
    );
  });

  return (
    <g>
      <g stroke="url(#wa-sun)" strokeWidth="3.4" strokeLinecap="round">
        {rays}
      </g>
      <circle cx={cx} cy={cy} r={r} fill="url(#wa-sun)" />
    </g>
  );
}

export function Moon({ cx = 32, cy = 27, r = 12 }: { cx?: number; cy?: number; r?: number }) {
  // Crescent by subtraction: a circle with a second circle masked out reads as
  // a moon at any size, where a hand-drawn crescent path distorts when scaled.
  const maskId = `wa-moon-mask-${cx}-${cy}-${r}`;
  return (
    <g>
      <mask id={maskId}>
        <rect x="0" y="0" width="64" height="64" fill="white" />
        <circle cx={cx + r * 0.55} cy={cy - r * 0.42} r={r * 0.92} fill="black" />
      </mask>
      <circle cx={cx} cy={cy} r={r} fill="url(#wa-moon)" mask={`url(#${maskId})`} />
    </g>
  );
}

export function Bolt() {
  return (
    <path
      d="M33.5 36 L25 50 L31.5 50 L28.5 60 L39.5 45.5 L32.5 45.5 L36 36 Z"
      fill="url(#wa-bolt)"
    />
  );
}

/** Falling drops. `heavy` slants them, which is how rain reads as driven. */
export function Drops({ count = 3, heavy = false }: { count?: number; heavy?: boolean }) {
  const positions = Array.from({ length: count }, (_, index) => 23 + index * (18 / count));
  return (
    <g stroke="url(#wa-rain)" strokeWidth={heavy ? 3.4 : 2.8} strokeLinecap="round">
      {positions.map((x, index) => (
        <line
          key={x}
          x1={x}
          y1={47 + (index % 2) * 2}
          x2={heavy ? x - 4 : x}
          y2={56 + (index % 2) * 2}
        />
      ))}
    </g>
  );
}

export function Flakes({ count = 3 }: { count?: number }) {
  const positions = Array.from({ length: count }, (_, index) => 24 + index * (16 / count));
  return (
    <g fill="url(#wa-snow)">
      {positions.map((x, index) => (
        <circle key={x} cx={x} cy={50 + (index % 2) * 4} r="2.6" />
      ))}
    </g>
  );
}

export function Hailstones() {
  return (
    <g fill="url(#wa-snow)">
      <circle cx="27" cy="51" r="2.8" />
      <circle cx="38" cy="55" r="2.8" />
    </g>
  );
}

export function FogLines() {
  return (
    <g stroke="url(#wa-cloud-dark)" strokeWidth="3.2" strokeLinecap="round" opacity="0.85">
      <line x1="18" y1="47" x2="46" y2="47" />
      <line x1="22" y1="54" x2="42" y2="54" />
    </g>
  );
}
