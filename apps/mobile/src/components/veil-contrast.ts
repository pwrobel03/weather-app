/**
 * The phenomenon channel's contrast arithmetic, kept apart from the component
 * that renders it: importing the component pulls in Skia's native setup, which
 * cannot load under Node, and this is the part worth testing.
 */

/**
 * How much contrast the backdrop filter should actually apply.
 *
 * On the web the veil carries `opacity` and `backdrop-filter` on one element,
 * so the browser composites the filtered backdrop *at that opacity* over the
 * unfiltered one - the veil being half transparent halves the contrast it
 * applies. A backdrop filter in Skia has no such attenuation and would come out
 * stronger than the web at the same number.
 *
 * Scaling the amount is an exact match rather than an approximation, because
 * contrast is affine per channel: blending `f(x)` and `x` at `a` yields the
 * affine function with amount `1 + (amount - 1) * a`.
 */
export function veilContrastAmount({
  contrast,
  opacity,
}: {
  contrast: number;
  opacity: number;
}): number {
  return 1 + (contrast - 1) * opacity;
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
