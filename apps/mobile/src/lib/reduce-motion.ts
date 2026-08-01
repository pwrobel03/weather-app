import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/**
 * Whether the system asks for less movement.
 *
 * Read once and then subscribed to, because it can change while the app is
 * open - somebody turns it on precisely when an animation is bothering them,
 * and a value captured at mount would make them relaunch to be heard.
 *
 * What this does *not* switch off is stated in design.md §8: an alert's
 * takeover of the screen stays. Taking the colour away would hide the severity
 * from exactly the people who asked for less motion rather than less meaning.
 */
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (!cancelled) setReduce(enabled);
    });

    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduce);
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

  return reduce;
}
