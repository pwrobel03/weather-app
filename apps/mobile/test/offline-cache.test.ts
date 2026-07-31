import type { Query } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { shouldPersist } from "../src/lib/offline-cache";

/**
 * What is allowed onto the disk.
 *
 * The persister writes whatever this returns true for, and it survives sign-out
 * - so the predicate is the only thing keeping one person's account data off
 * the next person's cold start. Worth testing for what it *rejects* far more
 * than for what it keeps.
 */
const query = (key: unknown[], status: "success" | "error" | "pending" = "success") =>
  ({ queryKey: key, state: { status } }) as unknown as Query;

describe("what the offline cache keeps", () => {
  it("keeps the three forecast queries", () => {
    expect(shouldPersist(query(["current", 52.2, 21.0]))).toBe(true);
    expect(shouldPersist(query(["hourly", 52.2, 21.0]))).toBe(true);
    expect(shouldPersist(query(["daily", 52.2, 21.0]))).toBe(true);
  });

  it("refuses anything belonging to the account", () => {
    // Signing out empties the cache in memory. A persisted copy would outlive
    // that and hand the next person to open the app the previous one's places
    // and settings.
    expect(shouldPersist(query(["profile"]))).toBe(false);
    expect(shouldPersist(query(["saved-locations"]))).toBe(false);
  });

  it("refuses warnings", () => {
    // A warning restored from disk is the one piece of stale data that can do
    // harm: it would announce a storm that ended overnight, in an app whose
    // whole claim is that its warnings are current.
    expect(shouldPersist(query(["active-alerts"]))).toBe(false);
    expect(shouldPersist(query(["alerts-at", 52.2, 21.0]))).toBe(false);
  });

  it("refuses a query that has not succeeded", () => {
    // Persisting a failure would restore the error state on the next launch and
    // show it offline, where nothing can clear it.
    expect(shouldPersist(query(["current", 52.2, 21.0], "error"))).toBe(false);
    expect(shouldPersist(query(["current", 52.2, 21.0], "pending"))).toBe(false);
  });
});
