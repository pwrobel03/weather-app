import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const ACCESS_TOKEN_KEY = "wx_access_token";
const REFRESH_TOKEN_KEY = "wx_refresh_token";
const ANONYMOUS_KEY = "wx_anonymous";

export type StoredSession = {
  accessToken: string;
  refreshToken: string;
  /**
   * True while the device has a user but no credentials on it.
   *
   * Kept here rather than derived from the profile because every screen needs
   * it during the first render, and asking the backend would mean a frame of
   * "signed out" on every cold start. Registering or signing in flips it.
   */
  anonymous: boolean;
};

/**
 * Session tokens on the device, in the Keychain (iOS) or the Keystore-backed
 * EncryptedSharedPreferences (Android) - roadmap commit 73.
 *
 * This is the mobile counterpart of apps/web's HttpOnly cookies, and it exists
 * for the same reason: the token must not sit anywhere ordinary application
 * code, a crash reporter, or a backup can read it. AsyncStorage would be plain
 * text on disk.
 *
 * SecureStore has no web implementation. The Expo web target is a development
 * convenience here, not a shipped surface, so it falls back to localStorage
 * with the trade-off stated rather than silently taken - on web the real
 * client is apps/web, which keeps its tokens server-side.
 */
export async function loadSession(): Promise<StoredSession | null> {
  const [accessToken, refreshToken, anonymous] = await Promise.all([
    getItem(ACCESS_TOKEN_KEY),
    getItem(REFRESH_TOKEN_KEY),
    getItem(ANONYMOUS_KEY),
  ]);

  if (!accessToken || !refreshToken) {
    return null;
  }
  // A session stored before this flag existed belongs to a registered user -
  // it could only have come from signing in.
  return { accessToken, refreshToken, anonymous: anonymous === "true" };
}

export async function saveSession(session: StoredSession): Promise<void> {
  await Promise.all([
    setItem(ACCESS_TOKEN_KEY, session.accessToken),
    setItem(REFRESH_TOKEN_KEY, session.refreshToken),
    setItem(ANONYMOUS_KEY, session.anonymous ? "true" : "false"),
  ]);
}

export async function clearSession(): Promise<void> {
  await Promise.all([
    deleteItem(ACCESS_TOKEN_KEY),
    deleteItem(REFRESH_TOKEN_KEY),
    deleteItem(ANONYMOUS_KEY),
  ]);
}

const isWeb = Platform.OS === "web";

async function getItem(key: string): Promise<string | null> {
  if (isWeb) return globalThis.localStorage?.getItem(key) ?? null;
  return SecureStore.getItemAsync(key);
}

async function setItem(key: string, value: string): Promise<void> {
  if (isWeb) {
    globalThis.localStorage?.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function deleteItem(key: string): Promise<void> {
  if (isWeb) {
    globalThis.localStorage?.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}
