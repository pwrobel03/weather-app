import { describe, expect, it } from "vitest";

import { isPhenomenonTranslated, phenomenonName } from "./phenomenon";

describe("phenomenonName", () => {
  it("leaves Polish alone, since IMGW already wrote it", () => {
    expect(phenomenonName("Burze z gradem", "pl")).toBe("Burze z gradem");
  });

  it("translates the names IMGW actually issues", () => {
    expect(phenomenonName("Burze z gradem", "en")).toBe("Thunderstorms with hail");
    expect(phenomenonName("Silny wiatr", "en")).toBe("Strong wind");
    expect(phenomenonName("Upał", "en")).toBe("Heat");
  });

  it("survives IMGW's inconsistent casing and spacing", () => {
    expect(phenomenonName("SILNY WIATR", "en")).toBe("Strong wind");
    expect(phenomenonName("  Silny   wiatr ", "en")).toBe("Strong wind");
  });

  it("reads the slash form as the conjunction it stands for", () => {
    // IMGW writes both "Zawieje/zamiecie śnieżne" and the spelled-out version.
    expect(phenomenonName("Zawieje/zamiecie śnieżne", "en")).toBe(
      "Blowing and drifting snow",
    );
  });

  it("falls back to the original for a name nobody has seen before", () => {
    // IMGW adding a phenomenon is a normal event, not an error condition, and
    // a warning headed "Unknown phenomenon" is worse than one headed in a
    // language the reader may still recognise.
    expect(phenomenonName("Trąba powietrzna", "en")).toBe("Trąba powietrzna");
  });
});

describe("isPhenomenonTranslated", () => {
  it("lets a screen say when the reader is looking at the original", () => {
    expect(isPhenomenonTranslated("Burze", "en")).toBe(true);
    expect(isPhenomenonTranslated("Trąba powietrzna", "en")).toBe(false);
  });

  it("is trivially true for a Polish reader", () => {
    expect(isPhenomenonTranslated("Trąba powietrzna", "pl")).toBe(true);
  });
});
