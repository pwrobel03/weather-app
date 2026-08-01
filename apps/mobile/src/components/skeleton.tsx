import { useEffect } from "react";
import { View, type ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { useReduceMotion } from "../lib/reduce-motion";

/** Slow enough to read as breathing rather than as flicker. */
const PERIOD_MS = 900;

/**
 * A placeholder shaped like the thing that is coming.
 *
 * Shaped, not generic: a spinner says "wait" and nothing else, while a block
 * the size of the hero says what is about to appear and stops the screen
 * jumping when it does.
 *
 * Opacity only. Animating a colour would cross the two themes' surfaces and
 * need a second set of values; animating size would make the placeholder lie
 * about the size of what is coming.
 */
export function Skeleton({
  className = "",
  style,
}: {
  className?: string;
  style?: ViewStyle;
}) {
  const reduceMotion = useReduceMotion();
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) {
      // Held at the dimmer end rather than the brighter one: still clearly a
      // placeholder, just not a moving one.
      pulse.value = 0.6;
      return;
    }

    pulse.value = withRepeat(withTiming(0.45, { duration: PERIOD_MS }), -1, true);
  }, [reduceMotion, pulse]);

  const animated = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className={`rounded-xl bg-linia/20 ${className}`}
      style={[style, animated]}
    />
  );
}

/**
 * The home screen's shape while its forecast is in flight.
 *
 * Proportions follow the real layout - a hero at 62% of the viewport, the
 * hourly strip, the seven-day list. Getting them wrong would replace one jump
 * with two: the skeleton settling, then the content settling elsewhere.
 */
export function HomeSkeleton({ heroHeight }: { heroHeight: number }) {
  return (
    <View className="flex-1 bg-tlo" accessibilityLabel="Ładowanie prognozy">
      <Skeleton className="rounded-b-[2.5rem]" style={{ height: heroHeight }} />

      <View className="gap-6 px-4 pt-5">
        <View className="gap-3">
          <Skeleton className="h-6 w-28" />
          <View className="flex-row gap-3">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-28 w-20 rounded-3xl" />
            ))}
          </View>
        </View>

        <View className="gap-2">
          <Skeleton className="h-6 w-24" />
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-11 w-full" />
          ))}
        </View>
      </View>
    </View>
  );
}
