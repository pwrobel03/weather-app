/**
 * Just enough OKLCH to compose the background channels.
 *
 * The channels multiply rather than replace each other - season tilts the hue,
 * temperature drives the chroma, time of day sets the lightness - and doing
 * that on hex triplets is not possible without a perceptual space to do it in.
 *
 * OKLCH rather than HSL, which is the obvious cheaper option, for one concrete
 * reason: in HSL a hue rotation changes perceived lightness, so tilting the
 * winter sky towards blue also darkens it, and correcting for that by hand is
 * how a channel system turns back into a table of hand-picked combinations.
 * OKLab was built so hue and lightness move independently.
 *
 * Hand-rolled rather than pulled from a library: this is sixty lines of
 * arithmetic from Björn Ottosson's published conversion, it has no runtime
 * dependencies, and @weather-app/core deliberately has none either.
 */
export type Oklch = {
  /** Perceptual lightness, 0-1. */
  l: number;
  /** Chroma. 0 is grey; sRGB tops out around 0.37 depending on hue. */
  c: number;
  /** Hue angle in degrees, 0-360. */
  h: number;
};

export function hexToOklch(hex: string): Oklch {
  const [r, g, b] = parseHex(hex).map(toLinear) as [number, number, number];

  const lms = [
    0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b,
    0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b,
    0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b,
  ].map(Math.cbrt) as [number, number, number];

  const labL = 0.2104542553 * lms[0] + 0.793617785 * lms[1] - 0.0040720468 * lms[2];
  const labA = 1.9779984951 * lms[0] - 2.428592205 * lms[1] + 0.4505937099 * lms[2];
  const labB = 0.0259040371 * lms[0] + 0.7827717662 * lms[1] - 0.808675766 * lms[2];

  const hue = (Math.atan2(labB, labA) * 180) / Math.PI;

  return {
    l: labL,
    c: Math.sqrt(labA * labA + labB * labB),
    h: hue < 0 ? hue + 360 : hue,
  };
}

export function oklchToHex({ l, c, h }: Oklch): string {
  const radians = (h * Math.PI) / 180;
  const labA = c * Math.cos(radians);
  const labB = c * Math.sin(radians);

  const lms = [
    l + 0.3963377774 * labA + 0.2158037573 * labB,
    l - 0.1055613458 * labA - 0.0638541728 * labB,
    l - 0.0894841775 * labA - 1.291485548 * labB,
  ].map((value) => value ** 3) as [number, number, number];

  const rgb: [number, number, number] = [
    4.0767416621 * lms[0] - 3.3077115913 * lms[1] + 0.2309699292 * lms[2],
    -1.2684380046 * lms[0] + 2.6097574011 * lms[1] - 0.3413193965 * lms[2],
    -0.0041960863 * lms[0] - 0.7034186147 * lms[1] + 1.707614701 * lms[2],
  ];

  // Clamping in sRGB rather than gamut-mapping in OKLCH. A channel combination
  // that lands outside sRGB is a bug in the channel ranges, not something to
  // paper over silently - and the composition tests assert the ranges stay
  // inside the gamut.
  return `#${rgb.map((value) => toHexByte(fromLinear(clamp01(value)))).join("")}`;
}

/**
 * Applies a channel's contribution to a colour.
 *
 * Every argument is optional and neutral by default, so a channel that has
 * nothing to say about a dimension leaves it exactly as it was - which is what
 * makes the channels composable in any order.
 */
export function adjust(
  hex: string,
  { hueShift = 0, chromaScale = 1, lightnessShift = 0 }: {
    /** Degrees, signed. Positive rotates towards warmer hues. */
    hueShift?: number;
    chromaScale?: number;
    /** Added to perceptual lightness, signed. */
    lightnessShift?: number;
  },
): string {
  const { l, c, h } = hexToOklch(hex);

  return oklchToHex({
    l: clamp01(l + lightnessShift),
    // Chroma has no upper bound in OKLCH itself, but everything past the sRGB
    // gamut clips to the same colour - capped so a stacked chroma boost cannot
    // silently flatten two different inputs into one output.
    c: Math.max(0, Math.min(c * chromaScale, MAX_CHROMA)),
    h: (((h + hueShift) % 360) + 360) % 360,
  });
}

/** Comfortably past what sRGB can show at any hue. */
const MAX_CHROMA = 0.4;

function parseHex(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  const full =
    value.length === 3
      ? value
          .split("")
          .map((char) => char + char)
          .join("")
      : value;

  return [
    Number.parseInt(full.slice(0, 2), 16) / 255,
    Number.parseInt(full.slice(2, 4), 16) / 255,
    Number.parseInt(full.slice(4, 6), 16) / 255,
  ];
}

function toLinear(value: number): number {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function fromLinear(value: number): number {
  return value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function toHexByte(value: number): string {
  return Math.round(value * 255)
    .toString(16)
    .padStart(2, "0")
    .toUpperCase();
}
