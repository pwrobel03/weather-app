import type { Locale } from "@weather-app/core";
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
  // Every path out of this function says why. Push is best-effort and must
  // never take the app down, but "no token appeared" is not a symptom anybody
  // can act on - and three silent returns are what made the first registration
  // on a real device impossible to diagnose.
  const give = (reason: string) => {
    console.warn(`[push] not registered: ${reason}`);
    return null;
  };

  // A simulator has no APNs/FCM registration to hand out, and asking produces
  // an error rather than a token.
  if (!Device.isDevice) return give("not a physical device");

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;

  if (status !== "granted") {
    // Only ask if we have not been refused before: iOS shows the system prompt
    // exactly once, and a second request silently resolves to denied.
    if (!existing.canAskAgain) return give("permission refused earlier and cannot be asked again");
    ({ status } = await Notifications.requestPermissionsAsync());
  }

  if (status !== "granted") return give(`permission ${status}`);

  if (Platform.OS === "android") {
    // Android needs a channel before anything can be delivered, and one
    // created after the first notification arrives is too late for it.
    // "alerts" is hardcoded on the backend too, in FcmPushClient's
    // ALERTS_CHANNEL_ID. Nothing checks the two match: the first real push went
    // out without naming a channel at all, and Firebase quietly substituted its
    // own - discarding the importance and sound configured right here.
    await Notifications.setNotificationChannelAsync("alerts", {
      name: "Ostrzeżenia IMGW",
      importance: Notifications.AndroidImportance.HIGH,
      // No `sound` key at all. expo-notifications reads that field as the name
      // of a bundled sound file, so "default" made it hunt for a file called
      // "default", fail to find one, and build the channel without the sound it
      // was asked for - in the one channel whose job is to wake somebody at 3am.
      // Omitting it is what selects the system notification sound.
      //
      // Android freezes a channel's sound at creation, so changing this only
      // takes effect on a fresh install. Nothing here can migrate it.
    });
  }

  try {
    // The device's own FCM registration, not an Expo push token. The backend
    // talks to FCM directly (decision 27), so the relay's token would be
    // addressed to a service we no longer send through - and asking for one
    // would require an Expo project this repository does not have.
    const { data: token } = await Notifications.getDevicePushTokenAsync();
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
  } catch (error) {
    // Push stays best-effort - the socket still works and the app must not
    // fail to start over a notification channel. But the reason is logged
    // rather than swallowed: an empty catch here is what made the first real
    // registration on a device impossible to diagnose, and "no token appeared"
    // is not a symptom anybody can act on.
    console.warn("[push] registration failed", error);
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
