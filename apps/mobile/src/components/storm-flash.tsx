import { Group, Rect, RadialGradient, vec } from "@shopify/react-native-skia";
import { useEffect } from "react";
import {
  Easing,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

const CYCLE_MS = 9000;

/**
 * Lightning.
 *
 * Built inside the same three constraints as the web version, and they are
 * worth restating because a phone is held closer to the face and often in the
 * dark:
 *
 * 1. Photosensitivity. WCAG 2.3.1 allows at most three flashes per second;
 *    this runs about one every nine, and lifts luminance a few percent rather
 *    than going white. A full-screen white flash behind a warning about a
 *    storm would be a hazard aimed precisely at the people the warning is for.
 * 2. It sits below the content, so warning text keeps its contrast throughout.
 * 3. Reduced motion removes it outright. Nothing is lost: the darkened sky and
 *    the falling texture already say thunderstorm, which is exactly why the
 *    channel puts the state in the colour and only the event in the motion.
 *
 * The animation runs on the UI thread through Reanimated, so it keeps time
 * while JavaScript is busy - one of the two reasons Skia was chosen over
 * layered gradients (follow-up.md point 11).
 */
export function StormFlash({
  width,
  height,
  intensity,
}: {
  width: number;
  height: number;
  intensity: number;
}) {
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) {
      progress.value = 0;
      return;
    }

    const hold = withTiming(0, { duration: CYCLE_MS * 0.92, easing: Easing.linear });
    // Two beats, as real lightning almost always is.
    const first = withTiming(1, { duration: 90, easing: Easing.out(Easing.quad) });
    const decay = withTiming(0.15, { duration: 140, easing: Easing.linear });
    const second = withTiming(0.8, { duration: 90, easing: Easing.out(Easing.quad) });
    const fade = withTiming(0, { duration: 400, easing: Easing.out(Easing.quad) });

    progress.value = withRepeat(withSequence(hold, first, decay, second, fade), -1, false);
  }, [progress, reducedMotion]);

  const opacity = useDerivedValue(() => progress.value * 0.5 * intensity);

  return (
    <Group opacity={opacity}>
      <Rect x={0} y={0} width={width} height={height}>
        <RadialGradient
          c={vec(width / 2, height * 0.18)}
          r={Math.max(width, height) * 0.8}
          colors={["rgb(226, 240, 255)", "rgba(226, 240, 255, 0)"]}
        />
      </Rect>
    </Group>
  );
}
