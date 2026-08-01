import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OfflineBanner } from "./offline-banner";

/**
 * The half of the offline cache that makes it honest.
 *
 * A service worker serving yesterday's page is only acceptable because the
 * page says how old it is - a cached document can carry a warning that has
 * since expired, and no filter inside the worker can reach into the HTML to
 * remove it. So these test the saying, not the caching.
 */
function setOnline(online: boolean) {
  Object.defineProperty(navigator, "onLine", { value: online, configurable: true });
}

function setCachedAt(stamp: string | null) {
  vi.stubGlobal("caches", {
    match: () =>
      Promise.resolve(
        stamp === null ? undefined : { headers: new Headers({ "x-cached-at": stamp }) },
      ),
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  setOnline(true);
});

describe("OfflineBanner", () => {
  it("says nothing at all while the network is up", () => {
    setOnline(true);
    render(<OfflineBanner />);

    expect(screen.queryByRole("status")).toBeNull();
  });

  it("announces the loss of connection politely, not assertively", async () => {
    // Losing signal is worth knowing and never worth interrupting whatever is
    // being read - unlike a warning, which is the opposite call.
    setOnline(false);
    setCachedAt(null);
    render(<OfflineBanner />);

    const banner = await screen.findByRole("status");
    expect(banner).toHaveAttribute("aria-live", "polite");
  });

  it("says how old the page it is showing is", async () => {
    setOnline(false);
    setCachedAt("2026-08-01T12:20:00.000Z");
    render(<OfflineBanner />);

    // The hour is formatted for the reader's locale, so this asserts that a
    // time is stated rather than pinning a particular rendering of it.
    expect(await screen.findByText(/Stan na \d{2}:\d{2}/)).toBeInTheDocument();
  });

  it("still says it is offline when it cannot tell how stale the page is", async () => {
    // A page opened from the browser's own cache rather than the worker's.
    // "No connection" without a time is still the more useful half.
    setOnline(false);
    setCachedAt(null);
    render(<OfflineBanner />);

    expect(await screen.findByText("Brak połączenia")).toBeInTheDocument();
    expect(screen.queryByText(/Stan na/)).toBeNull();
  });
});
