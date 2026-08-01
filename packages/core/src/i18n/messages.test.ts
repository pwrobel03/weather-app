import { describe, expect, it } from "vitest";

import { listFormat } from "./messages";

/**
 * The expected strings are what `Intl.ListFormat` itself produces for these
 * locales, captured from Node before the implementation was replaced. Hermes
 * has no `Intl.ListFormat`, so the constructor was `undefined` on a device and
 * every warning screen died rendering the places a warning covers - a crash no
 * test could see, because under Node the constructor exists.
 */
describe("listFormat", () => {
  it("joins Polish with 'i' and no comma before it", () => {
    expect(listFormat(["Kraków", "Rzeszów", "Tarnów"], "pl")).toBe("Kraków, Rzeszów i Tarnów");
    expect(listFormat(["Kraków", "Rzeszów"], "pl")).toBe("Kraków i Rzeszów");
  });

  it("joins English with 'and', also without an Oxford comma", () => {
    // en-GB, matching INTL_LOCALE - en-US would put a comma there.
    expect(listFormat(["Kraków", "Rzeszów", "Tarnów"], "en")).toBe("Kraków, Rzeszów and Tarnów");
    expect(listFormat(["Kraków", "Rzeszów"], "en")).toBe("Kraków and Rzeszów");
  });

  it("leaves a single item alone", () => {
    expect(listFormat(["Kraków"], "pl")).toBe("Kraków");
  });

  it("returns an empty string for no items", () => {
    // A warning with no matched places should read as nothing, not as a stray
    // separator.
    expect(listFormat([], "pl")).toBe("");
    expect(listFormat([], "en")).toBe("");
  });
});
