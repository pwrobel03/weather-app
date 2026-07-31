import { BlurView } from "expo-blur";
import { useColorScheme } from "nativewind";
import { useEffect, useState } from "react";
import { AccessibilityInfo, Pressable, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Path } from "react-native-svg";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** A press sinks the button rather than growing it: glass that grows covers
 *  the very thing the finger is aiming at. */
const PRESS = { damping: 18, stiffness: 320, mass: 0.5 } as const;

type Action = {
  label: string;
  icon: "settings" | "places";
  onPress: () => void;
};

/**
 * The screen's controls, pinned to the bottom corners.
 *
 * Bottom rather than in the header, because the header scrolls away with the
 * hero and a control that leaves the screen is one you have to go and find.
 * Corners rather than a single centre bar, because the middle belongs to the
 * page indicator - it says where you are, and that reading is worth the most
 * legible spot on the row.
 *
 * Each control is its own pane of glass. Apple's container merges panes that
 * sit close together; these sit at opposite edges, where merging would mean
 * one wide bar with nothing in the middle of it.
 *
 * Glass earns its keep over something worth seeing through. Here that is the
 * forecast scrolling underneath - and in the light theme, over a flat surface,
 * it thins to almost nothing, which is the caveat design.md §4 records rather
 * than a fault to fix.
 */
export function GlassBar({
  left,
  right,
  dots,
}: {
  left: Action;
  right: Action;
  /** Absent when there is only one place to look at. */
  dots?: { count: number; current: number };
}) {
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const [reduceTransparency, setReduceTransparency] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void AccessibilityInfo.isReduceTransparencyEnabled().then((enabled) => {
      if (!cancelled) setReduceTransparency(enabled);
    });

    const subscription = AccessibilityInfo.addEventListener(
      "reduceTransparencyChanged",
      setReduceTransparency,
    );
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

  const dark = colorScheme !== "light";

  return (
    <View
      pointerEvents="box-none"
      style={{ position: "absolute", left: 0, right: 0, bottom: insets.bottom + 10 }}
      className="flex-row items-center justify-between px-5"
    >
      <GlassButton action={left} dark={dark} opaque={reduceTransparency} />

      {dots ? (
        <Dots count={dots.count} current={dots.current} dark={dark} />
      ) : (
        // Keeps the two buttons in their corners when there is nothing to show
        // between them.
        <View />
      )}

      <GlassButton action={right} dark={dark} opaque={reduceTransparency} />
    </View>
  );
}

function Dots({ count, current, dark }: { count: number; current: number; dark: boolean }) {
  const colour = dark ? "bg-white" : "bg-[#0F1826]";

  return (
    <View
      className="flex-row items-center gap-1.5"
      accessibilityRole="adjustable"
      accessibilityLabel={`${current + 1} / ${count}`}
    >
      {Array.from({ length: count }, (_, index) => (
        <View
          key={index}
          className={`h-1.5 w-1.5 rounded-full ${colour}`}
          style={{ opacity: index === current ? 0.95 : 0.3 }}
        />
      ))}
    </View>
  );
}

function GlassButton({
  action,
  dark,
  opaque,
}: {
  action: Action;
  dark: boolean;
  opaque: boolean;
}) {
  const pressed = useSharedValue(0);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(1 - 0.07 * pressed.value, PRESS) }],
    opacity: withSpring(1 - 0.2 * pressed.value, PRESS),
  }));

  const stroke = dark ? "#FFFFFF" : "#0F1826";

  return (
    <AnimatedPressable
      onPress={action.onPress}
      onPressIn={() => (pressed.value = 1)}
      onPressOut={() => (pressed.value = 0)}
      accessibilityRole="button"
      // Icon-only, so this label is all a screen reader has to work with.
      accessibilityLabel={action.label}
      hitSlop={8}
      style={style}
      className="h-12 w-12 overflow-hidden rounded-full"
    >
      {opaque ? (
        // Not a weaker blur - a different material. Someone who turns
        // transparency off is saying translucency costs them legibility, and
        // answering with less translucency ignores what they said.
        <View className={`absolute inset-0 ${dark ? "bg-[#1A2331]" : "bg-white"}`} />
      ) : (
        <BlurView
          intensity={dark ? 55 : 75}
          tint={dark ? "dark" : "light"}
          style={{ position: "absolute", inset: 0 }}
        />
      )}

      {/* The rim. Glass reads as glass because its edge catches light, not
          because its middle is blurred. */}
      <View
        pointerEvents="none"
        className={`absolute inset-0 rounded-full border ${
          dark ? "border-white/25" : "border-white/80"
        }`}
      />

      <View className="flex-1 items-center justify-center">
        <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
          {action.icon === "settings" ? <GearIcon stroke={stroke} /> : <PinIcon stroke={stroke} />}
        </Svg>
      </View>
    </AnimatedPressable>
  );
}

/**
 * A cog, not a sun.
 *
 * The first attempt was a circle with eight straight rays, which is exactly
 * how a sun is drawn - in a weather app, of all places. Teeth are short bars
 * with square ends set away from the hub, and that gap is what separates the
 * two shapes at a glance.
 */
function GearIcon({ stroke }: { stroke: string }) {
  return (
    <>
      <Circle cx="12" cy="12" r="3.1" stroke={stroke} strokeWidth="1.7" />
      <Path
        d="M12 2.6v2.6M12 18.8v2.6M21.4 12h-2.6M5.2 12H2.6M18.65 5.35l-1.85 1.85M7.2 16.8l-1.85 1.85M18.65 18.65 16.8 16.8M7.2 7.2 5.35 5.35"
        stroke={stroke}
        strokeWidth="2.6"
        strokeLinecap="butt"
      />
    </>
  );
}

function PinIcon({ stroke }: { stroke: string }) {
  return (
    <>
      <Path
        d="M12 21s6.5-5.6 6.5-10.2A6.5 6.5 0 0 0 5.5 10.8C5.5 15.4 12 21 12 21Z"
        stroke={stroke}
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <Circle cx="12" cy="10.5" r="2.3" stroke={stroke} strokeWidth="1.7" />
    </>
  );
}
