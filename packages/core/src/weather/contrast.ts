/**
 * WCAG relative luminance and contrast, for asserting the palette rather than
 * eyeballing it.
 *
 * follow-up.md sets one hard constraint: a warning's text must be legible
 * whatever the background is doing. A constraint that is only ever checked by
 * looking is one that breaks the first time somebody adjusts a token, and
 * breaks silently - so it is checked here by arithmetic instead.
 *
 * The formula is the one from WCAG 2.1, not a perceptual model. It is what
 * accessibility rules are actually written against, and matching what the
 * audit tools compute matters more here than matching what the eye reports.
 */

/** 4.5:1 - the WCAG AA floor for text below 18.66px, which is most of it. */
export const AA_BODY = 4.5;

/** 3:1 - the AA floor for large text and for the boundary of a control. */
export const AA_LARGE = 3;

export function contrastRatio(foreground: string, background: string): number {
  const light = relativeLuminance(foreground);
  const dark = relativeLuminance(background);

  const [brighter, dimmer] = light > dark ? [light, dark] : [dark, light];
  return (brighter + 0.05) / (dimmer + 0.05);
}

/**
 * Flattens a translucent colour onto what is behind it.
 *
 * Half the palette is an alpha over a surface - muted text at 68%, a rim at
 * 20% - and the ratio of a colour that is partly the thing behind it is not a
 * property of the colour alone. Without this the audit would be measuring
 * pairs that never appear on screen.
 */
export function over(foreground: string, background: string, alpha: number): string {
  const top = toRgb(foreground);
  const bottom = toRgb(background);

  const blend = (index: 0 | 1 | 2) =>
    Math.round(top[index] * alpha + bottom[index] * (1 - alpha));

  return `#${[blend(0), blend(1), blend(2)]
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("")}`;
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = toRgb(hex).map((channel) => {
    const ratio = channel / 255;
    return ratio <= 0.04045 ? ratio / 12.92 : ((ratio + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function toRgb(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  const full =
    value.length === 3
      ? value
          .split("")
          .map((channel) => channel + channel)
          .join("")
      : value;

  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}
