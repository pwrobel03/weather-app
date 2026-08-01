/**
 * The arithmetic behind a trend chart, with no renderer attached.
 *
 * Same split as the weather icons: geometry here, two renderers over it - SVG
 * on web, react-native-svg on mobile. A chart that is laid out twice is a chart
 * whose two clients disagree about where the freezing line sits, and the axis
 * is the part a reader trusts without checking.
 */

export type Box = {
  width: number;
  height: number;
  /** Room for the axis labels and for a marker that sits on the edge. */
  padding: { top: number; right: number; bottom: number; left: number };
};

export type Extent = { min: number; max: number };

export type Point = { x: number; y: number };

export type Bar = { x: number; y: number; width: number; height: number };

/**
 * The range an axis should cover.
 *
 * Padded by a tenth of the span so a line never runs along the top edge, and
 * never flat against the floor where it reads as a boundary rather than a
 * value. A series with no spread at all - twelve hours of exactly 4 degrees -
 * would otherwise divide by zero, so it gets a degree either side and renders
 * as the flat line it is.
 */
export function extentOf(values: number[], { includeZero = false } = {}): Extent {
  if (values.length === 0) return { min: 0, max: 1 };

  const min = includeZero ? Math.min(...values, 0) : Math.min(...values);
  const max = includeZero ? Math.max(...values, 0) : Math.max(...values);

  if (min === max) return { min: min - 1, max: max + 1 };

  // A bound that was forced to zero is not padded past it. Padding it would
  // float the bars off a baseline that is the whole point of forcing zero -
  // and put "no rain at all" above the floor of its own chart.
  const pad = (max - min) * 0.1;
  return {
    min: includeZero && min === 0 ? 0 : min - pad,
    max: includeZero && max === 0 ? 0 : max + pad,
  };
}

/** Where a value sits vertically: `min` at the bottom edge, `max` at the top. */
export function scaleY(value: number, extent: Extent, box: Box): number {
  const { top, bottom } = box.padding;
  const usable = box.height - top - bottom;
  const ratio = (value - extent.min) / (extent.max - extent.min);

  return top + usable * (1 - ratio);
}

/** Evenly spaced across the plot, first and last flush with its edges. */
export function scaleX(index: number, count: number, box: Box): number {
  const { left, right } = box.padding;
  const usable = box.width - left - right;
  if (count <= 1) return left + usable / 2;

  return left + (usable * index) / (count - 1);
}

export function pointsFor(values: number[], extent: Extent, box: Box): Point[] {
  return values.map((value, index) => ({
    x: scaleX(index, values.length, box),
    y: scaleY(value, extent, box),
  }));
}

/**
 * A polyline, not a spline.
 *
 * A smoothed curve invents readings between the hours - it would dip below the
 * lowest forecast temperature on the way into a trough, and a chart that shows
 * a colder hour than any hour forecast is telling a small lie every time.
 */
export function linePath(points: Point[]): string {
  if (points.length === 0) return "";

  return points
    .map((point, index) => `${index === 0 ? "M" : "L"}${round(point.x)} ${round(point.y)}`)
    .join(" ");
}

/**
 * The same line closed against the baseline, for a fill under it.
 *
 * Anchored to the bottom of the plot rather than to the zero of the scale: the
 * fill is there to give the line weight, and a temperature axis that starts at
 * -3 has no zero to sit on.
 */
export function areaPath(points: Point[], box: Box): string {
  if (points.length === 0) return "";

  const floor = box.height - box.padding.bottom;
  const first = points[0]!;
  const last = points[points.length - 1]!;

  return `${linePath(points)} L${round(last.x)} ${round(floor)} L${round(first.x)} ${round(floor)} Z`;
}

/**
 * Bars hanging from their value down to the baseline.
 *
 * Width comes from the gap between slots less a two-pixel breather, which is
 * what keeps adjacent bars legible as two bars rather than one block. A single
 * reading gets a fixed width instead, since there is no neighbour to measure
 * against.
 */
export function barsFor(
  values: number[],
  extent: Extent,
  box: Box,
  { gap = 2 } = {},
): Bar[] {
  const floor = box.height - box.padding.bottom;
  const usable = box.width - box.padding.left - box.padding.right;
  const slot = values.length > 1 ? usable / values.length : usable;
  const width = Math.max(slot - gap, 1);

  return values.map((value, index) => {
    const y = scaleY(value, extent, box);
    return {
      x: box.padding.left + slot * index + gap / 2,
      y,
      width,
      // Never negative, and never zero for a reading that exists: a 1% chance
      // of rain should be a hairline, not an absence.
      height: Math.max(floor - y, value > extent.min ? 1 : 0),
    };
  });
}

/**
 * Round numbers to label an axis with, at most `count` of them.
 *
 * Steps are chosen from 1, 2, 5 and their powers of ten - the intervals people
 * read without doing arithmetic. A tick at 3.7 degrees is technically evenly
 * spaced and useless.
 */
export function niceTicks(extent: Extent, count = 3): number[] {
  const span = extent.max - extent.min;
  if (span <= 0 || count < 1) return [];

  const rough = span / count;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const normalised = rough / magnitude;
  const step = (normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 5 ? 5 : 10) * magnitude;

  const ticks: number[] = [];
  for (let tick = Math.ceil(extent.min / step) * step; tick <= extent.max; tick += step) {
    // Rounded because repeated addition of 0.1 does not stay 0.1.
    ticks.push(Number(tick.toFixed(6)));
  }
  return ticks;
}

/**
 * Which reading a pointer at `x` is nearest.
 *
 * Nearest rather than "the slot it fell inside": the marks are thin and the
 * cursor is not, so hovering just left of a point should read that point
 * rather than the gap before it.
 */
export function indexAtX(x: number, count: number, box: Box): number {
  if (count <= 0) return -1;

  const { left, right } = box.padding;
  const usable = box.width - left - right;
  if (usable <= 0 || count === 1) return 0;

  const ratio = (x - left) / usable;
  return Math.min(Math.max(Math.round(ratio * (count - 1)), 0), count - 1);
}

function round(value: number): number {
  return Number(value.toFixed(2));
}
