import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/**
 * Whether the system asks for less translucency.
 *
 * What this must not become is a weaker blur. Somebody who turns transparency
 * off is saying translucency costs them legibility, and answering with less
 * translucency answers a question they did not ask - the surface has to become
 * a different material, opaque, not a thinner version of the same one.
 *
 * Subscribed rather than read once, for the same reason as reduced motion: the
 * setting gets turned on at the moment the interface becomes hard to read.
 */
export function useReduceTransparency(): boolean {
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void AccessibilityInfo.isReduceTransparencyEnabled().then((enabled) => {
      if (!cancelled) setReduce(enabled);
    });

    const subscription = AccessibilityInfo.addEventListener(
      "reduceTransparencyChanged",
      setReduce,
    );
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

  return reduce;
}
