import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import type { Query } from "@tanstack/react-query";

/**
 * The last known forecast, kept across launches.
 *
 * A weather app opened without a signal should show the forecast it had rather
 * than a spinner: yesterday evening's seven-day is still most of the answer,
 * and "no connection" is not. What makes this cheap is that react-query is
 * already the data layer on every screen - persisting its cache covers the
 * forecast, the warnings and the profile at once, with no component learning
 * that an offline mode exists.
 *
 * `dataUpdatedAt` comes along for free, which is what lets a screen say how old
 * what it is showing is. Stale data presented as current is the failure mode
 * this feature invites, and the timestamp is the whole defence against it.
 */
export const CACHE_KEY = "wx_query_cache";

/**
 * Bumped whenever a persisted response's shape changes.
 *
 * Without it, a client that changes a field name reads back yesterday's shape
 * into today's components and crashes on the first render - offline, where the
 * network cannot correct it. A mismatch throws the whole cache away, which is
 * the cheap outcome: one cold start.
 */
export const CACHE_VERSION = "1";

/** A day. Beyond that a forecast is not stale, it is wrong. */
export const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: CACHE_KEY,
  // Batched rather than written per query settle: three forecast queries land
  // within a frame of each other on every page of the pager, and each write
  // serialises the entire cache.
  throttleTime: 2_000,
});

/**
 * Which queries are worth keeping on disk.
 *
 * Only successful ones, and never the profile or anything else that is a
 * property of the account rather than of the weather. Signing out clears the
 * cache in memory; a persisted copy would survive that and hand the next
 * person to open the app the previous one's settings.
 */
export function shouldPersist(query: Query): boolean {
  if (query.state.status !== "success") return false;

  const root = query.queryKey[0];
  return root === "current" || root === "hourly" || root === "daily";
}
