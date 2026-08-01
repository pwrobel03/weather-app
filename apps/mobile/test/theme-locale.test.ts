import { describe, expect, it } from "vitest";

import {
  deviceLocale,
  isThemeChoice,
  localeFromTag,
  resolveLocale,
} from "../src/lib/preferences";

/**
 * The decisions behind the two settings that change every screen at once.
 *
 * Neither provider is rendered here - the renderer is deliberately absent from
 * this suite (see vitest.config.ts). What is left is what can actually be
 * wrong: which of the three language sources wins, and what is allowed through
 * to NativeWind. Both are plain functions precisely so they can be reached
 * from a Node test.
 */
describe("language resolution", () => {
  it("prefers a stored choice over whatever the phone is set to", () => {
    // The setting exists for the person whose phone is Polish and who wants
    // the app in English. If the device won here, the choice would appear not
    // to save - it would come back changed on the next launch.
    expect(resolveLocale("en", "pl")).toBe("en");
    expect(resolveLocale("pl", "en")).toBe("pl");
  });

  it("keeps the device language when nothing has been chosen", () => {
    expect(resolveLocale(null, "en")).toBe("en");
    expect(resolveLocale(null, "pl")).toBe("pl");
  });

  it("ignores a stored value it does not recognise", () => {
    // A key left by an older build, or one edited by hand. Falling back to the
    // device is the same as never having chosen, which is the honest reading
    // of a value nobody can interpret.
    expect(resolveLocale("de", "pl")).toBe("pl");
    expect(resolveLocale("", "en")).toBe("en");
    expect(resolveLocale("PL", "en")).toBe("en");
  });

  it("reads Polish from any Polish tag, whatever the region", () => {
    expect(localeFromTag("pl")).toBe("pl");
    expect(localeFromTag("pl-PL")).toBe("pl");
    expect(localeFromTag("PL-pl")).toBe("pl");
  });

  it("sends every other language to English rather than to Polish", () => {
    // Somebody whose phone is German reads English more readily than Polish.
    expect(localeFromTag("en-GB")).toBe("en");
    expect(localeFromTag("de-DE")).toBe("en");
    expect(localeFromTag("uk-UA")).toBe("en");
  });

  it("returns one of the two languages for whatever this runtime reports", () => {
    // Guards the Intl call itself. Hermes has already shipped one missing Intl
    // API in this app (ListFormat, phase 9.5), and the failure mode there was
    // a screen that threw rather than a wrong default.
    expect(["pl", "en"]).toContain(deviceLocale());
  });
});

describe("theme choice from storage", () => {
  it("accepts the three choices, system among them", () => {
    // "system" is a choice and not the absence of one: it means follow the
    // phone, which is different from having never opened the setting.
    expect(isThemeChoice("system")).toBe(true);
    expect(isThemeChoice("light")).toBe(true);
    expect(isThemeChoice("dark")).toBe(true);
  });

  it("rejects anything else before it reaches NativeWind", () => {
    // colorScheme.set takes what it is handed; a value no stylesheet resolves
    // against leaves the app with neither palette.
    expect(isThemeChoice(null)).toBe(false);
    expect(isThemeChoice("")).toBe(false);
    expect(isThemeChoice("System")).toBe(false);
    expect(isThemeChoice("auto")).toBe(false);
  });
});
