import { describe, expect, it } from "vitest";

import { AA_BODY, AA_LARGE, contrastRatio, over } from "./contrast";

/**
 * The palette, audited rather than admired.
 *
 * Every pair below is one that actually appears on a screen. The hard
 * constraint from follow-up.md is the first block: a warning has to be legible
 * whatever the background is doing, and the alert card's whole reason for being
 * opaque is that it is the only way to promise that.
 *
 * These are literals rather than imports from the tokens package on purpose.
 * A test that reads the same constant the code reads passes when the constant
 * changes; this one fails, which is the entire point of having it.
 */
const INK = "#E8ECF2";
const INK_MUTED = "#8A94A6";
const ALERT_MATERIAL = "#10141B";
const SURFACE_DARK = "#16202F";
const GROUND_DARK = "#070A11";

const LIGHT_INK = "#0F1826";
const LIGHT_INK_MUTED = "#5A667A";
const LIGHT_SURFACE = "#FFFFFF";
const LIGHT_GROUND = "#E8EDF5";

const WARNING = { 1: "#F5C518", 2: "#F08A24", 3: "#E0342B" } as const;

describe("the alert card, which has to hold whatever is behind it", () => {
  it("carries body text well past the floor", () => {
    expect(contrastRatio(INK, ALERT_MATERIAL)).toBeGreaterThanOrEqual(AA_BODY);
  });

  it("keeps its secondary text readable too", () => {
    // The validity line and the office name. Smaller and quieter, but a
    // warning nobody can read the hours of is half a warning.
    expect(contrastRatio(INK_MUTED, ALERT_MATERIAL)).toBeGreaterThanOrEqual(AA_BODY);
  });

  it.each([1, 2, 3] as const)("shows severity %i as a mark that meets the non-text floor", (level) => {
    // The scale is worn by the triangle and the bar down the card's edge, not
    // by the word beside them. That is a consequence of this very audit: level
    // 3 measures 4.13:1 here, which clears 3:1 for a graphic and misses 4.5:1
    // for text at the size the label is set. The word wears text ink instead.
    expect(contrastRatio(WARNING[level], ALERT_MATERIAL)).toBeGreaterThanOrEqual(AA_LARGE);
  });

  it("would fail the text floor for level 3, which is why the label is not coloured", () => {
    // Pinned deliberately. If somebody lightens the token until this passes,
    // this test failing is the prompt to reconsider the label as well - and if
    // somebody re-colours the label, the number they need is right here.
    expect(contrastRatio(WARNING[3], ALERT_MATERIAL)).toBeLessThan(AA_BODY);
  });
});

describe("dark theme surfaces", () => {
  it("puts body text over both the ground and the raised surface", () => {
    expect(contrastRatio(INK, GROUND_DARK)).toBeGreaterThanOrEqual(AA_BODY);
    expect(contrastRatio(INK, SURFACE_DARK)).toBeGreaterThanOrEqual(AA_BODY);
  });

  it("keeps muted text above the body floor, not merely visible", () => {
    // Muted is where a palette usually fails: it is chosen to recede, and
    // "recedes" and "cannot be read" are one adjustment apart.
    expect(contrastRatio(INK_MUTED, GROUND_DARK)).toBeGreaterThanOrEqual(AA_BODY);
    expect(contrastRatio(INK_MUTED, SURFACE_DARK)).toBeGreaterThanOrEqual(AA_BODY);
  });
});

describe("light theme surfaces", () => {
  it("puts body text over both the ground and the raised surface", () => {
    expect(contrastRatio(LIGHT_INK, LIGHT_GROUND)).toBeGreaterThanOrEqual(AA_BODY);
    expect(contrastRatio(LIGHT_INK, LIGHT_SURFACE)).toBeGreaterThanOrEqual(AA_BODY);
  });

  it("keeps muted text above the body floor", () => {
    expect(contrastRatio(LIGHT_INK_MUTED, LIGHT_GROUND)).toBeGreaterThanOrEqual(AA_BODY);
    expect(contrastRatio(LIGHT_INK_MUTED, LIGHT_SURFACE)).toBeGreaterThanOrEqual(AA_BODY);
  });
});

describe("text over the hero", () => {
  it("holds white against the darkest and lightest the sky gets", () => {
    // The hero's colour is composed from four channels, so no single value can
    // be asserted. These two are the extremes the composition is bounded by:
    // a winter night and the brightest summer noon.
    expect(contrastRatio("#FFFFFF", "#0B1220")).toBeGreaterThanOrEqual(AA_BODY);
    expect(contrastRatio("#FFFFFF", "#5B7FB5")).toBeGreaterThanOrEqual(AA_LARGE);
  });

  it("keeps the metrics shelf legible where it is dimmest", () => {
    // The shelf is black at 35% over the sky. Measured flattened, because the
    // ratio of a translucent surface is not a property of its own colour.
    const shelf = over("#000000", "#5B7FB5", 0.35);

    expect(contrastRatio("#FFFFFF", shelf)).toBeGreaterThanOrEqual(AA_BODY);
  });
});
