import type { Locale } from "@weather-app/core";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { authorizedClient } from "../auth/session";

/** The token this device is currently registered under, so sign-out can
 * release exactly that one. */
let currentToken: string | null = null;

/**
 * Expo push registration, for warnings that arrive while the app is closed.
 *
 * The WebSocket only exists while the app is in the foreground, which is
 * exactly when a weather warning matters least - the user is already looking
 * at the screen. Push is the channel that matters, and it is the reason this
 * app exists at all.
 */
export async function registerForPushNotifications(locale: Locale): Promise<string | null> {
  // A simulator has no APNs/FCM registration to hand out, and asking produces
  // an error rather than a token.
  if (!Device.isDevice) return null;

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;

  if (status !== "granted") {
    // Only ask if we have not been refused before: iOS shows the system prompt
    // exactly once, and a second request silently resolves to denied.
    if (!existing.canAskAgain) return null;
    ({ status } = await Notifications.requestPermissionsAsync());
  }

  if (status !== "granted") return null;

  if (Platform.OS === "android") {
    // Android needs a channel before anything can be delivered, and one
    // created after the first notification arrives is too late for it.
    await Notifications.setNotificationChannelAsync("alerts", {
      name: "Ostrzeżenia IMGW",
      importance: Notifications.AndroidImportance.HIGH,
      sound: "default",
    });
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    // The chosen language travels with the token, not with the account: iOS
    // and Android both allow a language per app, so the same account can want
    // Polish on the phone and English on the tablet (follow-up.md point 12).
    // The zone travels with the token beside the language, and for the same
    // reason: quiet hours belong to the phone next to the bed. Read from Intl,
    // which already answers this on every runtime the app runs on.
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    await authorizedClient().POST("/api/users/me/push-tokens", {
      body: { token, locale, timeZone },
    });
    currentToken = token;
    return token;
  } catch {
    // No project id yet, no network, or a rejected registration. Push is a
    // best-effort second channel - the socket still works.
    return null;
  }
}

/**
 * Drops the token server-side, so the next warning for that account does not
 * land on a device somebody else is now holding.
 *
 * Must run *before* the session is cleared - unregistering is itself an
 * authenticated call, so a sign-out that clears tokens first leaves the
 * registration behind with no way to reach it.
 */
export async function releasePushToken(): Promise<void> {
  const token = currentToken;
  if (!token) return;
  currentToken = null;

  try {
    await authorizedClient().DELETE("/api/users/me/push-tokens", {
      params: { query: { token } },
    });
  } catch {
    // Nothing useful to do about it here; the backend prunes tokens Expo
    // reports as dead.
  }
}
