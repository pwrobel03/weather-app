import { Link } from "expo-router";
import { cssInterop } from "nativewind";

/**
 * Teaches NativeWind to style expo-router's `<Link>`.
 *
 * Without this, `className` on a `<Link>` is silently dropped: the prop is not
 * an error, it simply never reaches a style, and the label falls back to the
 * platform default. On this app's palette that default is black text on a navy
 * hero and on near-black tiles - every navigation affordance in the app,
 * present in the layout, readable by a screen reader, and invisible to the eye.
 *
 * Registered centrally rather than fixed at the call sites, because the call
 * sites were never wrong: thirteen `<Link className>` across eight files all
 * read correctly and all rendered black. Patching them individually fixes
 * thirteen screens and guarantees nothing about the fourteenth.
 *
 * Only the colour was ever missing, so nothing about the existing markup
 * changes - `cssInterop` maps `className` onto the `style` prop that `<Link>`
 * already forwards to its underlying `<Text>`.
 */
cssInterop(Link, { className: "style" });
