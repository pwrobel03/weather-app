import { describe, expect, it } from "vitest";

import { describeAmendment, type AlertRevision } from "./amendment";

/**
 * What a reader is told when IMGW changes a warning under them.
 *
 * The formatter is injected rather than imported so these assert the sentence
 * and not a locale's idea of what "14:20" looks like.
 */
const time = (isoTimestamp: string) => isoTimestamp.slice(11, 16);

const revision = (over: Partial<AlertRevision> = {}): AlertRevision =>
  ({
    event: "Burze",
    severity: "2",
    validFrom: "2026-08-01T10:00:00Z",
    validTo: "2026-08-01T20:00:00Z",
    recordedAt: "2026-08-01T14:20:00Z",
    ...over,
  }) as AlertRevision;

describe("describeAmendment", () => {
  it("says nothing about a warning that was never amended", () => {
    // The common case by a wide margin: most warnings are issued once and
    // expire unchanged, and a component rendering this should disappear rather
    // than announce that nothing happened.
    expect(describeAmendment([], { severity: "2", validTo: "2026-08-01T20:00:00Z" }, "pl", time))
      .toBeNull();
  });

  it("leads with severity when the level went up", () => {
    const result = describeAmendment(
      [revision({ severity: "2" })],
      { severity: "3", validTo: "2026-08-01T20:00:00Z" },
      "pl",
      time,
    );

    expect(result).toEqual({ escalated: true, text: "Podniesione z 2. na 3. stopień o 14:20" });
  });

  it("marks a drop as a change but not as an escalation", () => {
    // The emphasis is reserved for things getting worse. A level coming down
    // is worth saying and not worth shouting.
    const result = describeAmendment(
      [revision({ severity: "3" })],
      { severity: "1", validTo: "2026-08-01T20:00:00Z" },
      "pl",
      time,
    );

    expect(result?.escalated).toBe(false);
    expect(result?.text).toContain("Obniżone");
  });

  it("reports a longer warning when only the hours moved", () => {
    const result = describeAmendment(
      [revision({ validTo: "2026-08-01T20:00:00Z" })],
      { severity: "2", validTo: "2026-08-01T23:00:00Z" },
      "pl",
      time,
    );

    expect(result).toEqual({ escalated: false, text: "Przedłużone do 23:00 o 14:20" });
  });

  it("does not call an extension an escalation", () => {
    // Lasting longer is not the same as being more dangerous, and letting the
    // emphasis mean two things would make it mean neither.
    const result = describeAmendment(
      [revision()],
      { severity: "2", validTo: "2026-08-02T06:00:00Z" },
      "pl",
      time,
    );

    expect(result?.escalated).toBe(false);
  });

  it("prefers severity over hours when both moved", () => {
    // IMGW usually changes both at once. The level is the statement about the
    // day; the hours are a detail of it.
    const result = describeAmendment(
      [revision({ severity: "1", validTo: "2026-08-01T18:00:00Z" })],
      { severity: "3", validTo: "2026-08-02T02:00:00Z" },
      "pl",
      time,
    );

    expect(result?.text).toContain("Podniesione");
    expect(result?.escalated).toBe(true);
  });

  it("says something changed when only the wording did", () => {
    // Worth reporting, not worth quoting: IMGW's free text is a paragraph, and
    // a diff of one on a phone is noise.
    const result = describeAmendment(
      [revision({ content: "Stara treść" })],
      { severity: "2", validTo: "2026-08-01T20:00:00Z" },
      "pl",
      time,
    );

    expect(result?.text).toBe("Zaktualizowane przez IMGW o 14:20");
  });

  it("describes the most recent amendment, not the first", () => {
    // A warning amended three times should report where it is now, not where
    // it started - the history screen is a different question.
    const result = describeAmendment(
      [revision({ severity: "1" }), revision({ severity: "2", recordedAt: "2026-08-01T16:45:00Z" })],
      { severity: "3", validTo: "2026-08-01T20:00:00Z" },
      "pl",
      time,
    );

    expect(result?.text).toBe("Podniesione z 2. na 3. stopień o 16:45");
  });

  it("speaks English too", () => {
    const result = describeAmendment(
      [revision({ severity: "2" })],
      { severity: "3", validTo: "2026-08-01T20:00:00Z" },
      "en",
      time,
    );

    expect(result?.text).toBe("Raised from level 2 to level 3 at 14:20");
  });
});
