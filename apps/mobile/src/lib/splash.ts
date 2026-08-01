import * as SplashScreen from "expo-splash-screen";

/**
 * Holds the launch screen until the first screen can be shown whole.
 *
 * This screen is expensive to assemble: a Skia canvas composing four
 * background channels, SVG weather art, and three forecast queries. Revealed as
 * each part arrives, it reads as a broken app rather than a loading one - the
 * gradient appears, then jumps as the hero fills, then jumps again as the strip
 * measures.
 *
 * The cap is the part worth arguing about. "Until everything is loaded" hands
 * the screen to the slowest request on the worst connection, and a splash held
 * for fifteen seconds is a worse failure than a hero that arrives a beat before
 * its forecast. Past the cap the app shows what it has.
 */
const CAP_MS = 4000;

let released = false;
let capTimer: ReturnType<typeof setTimeout> | null = null;

export function holdSplash(): void {
  // Errors here are deliberately swallowed: the module throws if the native
  // splash is already gone, which is a race, not a fault, and never a reason
  // to fail a launch.
  void SplashScreen.preventAutoHideAsync().catch(() => {});
  capTimer = setTimeout(releaseSplash, CAP_MS);
}

/** Idempotent - whichever of the two conditions arrives first wins. */
export function releaseSplash(): void {
  if (released) return;
  released = true;

  if (capTimer !== null) {
    clearTimeout(capTimer);
    capTimer = null;
  }
  void SplashScreen.hideAsync().catch(() => {});
}
