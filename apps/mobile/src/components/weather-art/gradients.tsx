import { createContext, useContext } from "react";
import { Defs, LinearGradient, Stop } from "react-native-svg";

/**
 * The same gradients as apps/web's weather-art, on the react-native-svg
 * renderer.
 *
 * One structural difference from web, forced by the platform. On web the
 * gradients are declared once near the document root and every icon references
 * them by a fixed id; there is one document, so one set of ids is enough.
 * React Native has no shared document - each <Svg> is its own root - so the
 * defs travel with the icon, and the ids have to be unique per instance.
 * Reusing a fixed id across two mounted icons resolves by mount order on
 * Android, which shows up as an icon rendering in another icon's colours.
 *
 * The prefix comes from React's useId and reaches the parts through context,
 * so a primitive stays as readable as its web counterpart instead of taking a
 * prefix argument it never uses for anything else.
 */
const GradientIdContext = createContext("wa");

export function useGradientId(name: string): string {
  return `url(#${useContext(GradientIdContext)}-${name})`;
}

export function WeatherArtGradients({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <GradientIdContext.Provider value={id}>
      <Defs>
        <LinearGradient id={`${id}-sun`} gradientUnits="userSpaceOnUse" x1="32" y1="12" x2="32" y2="42">
          <Stop offset="0%" stopColor="#FFE58A" />
          <Stop offset="55%" stopColor="#FFD24D" />
          <Stop offset="100%" stopColor="#F5A623" />
        </LinearGradient>

        <LinearGradient id={`${id}-moon`} gradientUnits="userSpaceOnUse" x1="20" y1="14" x2="46" y2="40">
          <Stop offset="0%" stopColor="#F2F6FF" />
          <Stop offset="100%" stopColor="#C3D0E6" />
        </LinearGradient>

        {/* Fair-weather cloud: cool white, never grey - grey reads as gloom
            even when the forecast is mild. */}
        <LinearGradient id={`${id}-cloud-light`} gradientUnits="userSpaceOnUse" x1="32" y1="10" x2="32" y2="48">
          <Stop offset="0%" stopColor="#FFFFFF" />
          <Stop offset="60%" stopColor="#EAF0F8" />
          <Stop offset="100%" stopColor="#C8D4E4" />
        </LinearGradient>

        {/* Storm cloud: the weight comes from value, not from saturation, so it
            stays in the cool neutrals the base palette lives in. */}
        <LinearGradient id={`${id}-cloud-dark`} gradientUnits="userSpaceOnUse" x1="32" y1="10" x2="32" y2="52">
          <Stop offset="0%" stopColor="#B9C4D6" />
          <Stop offset="55%" stopColor="#8A94A6" />
          <Stop offset="100%" stopColor="#5B6472" />
        </LinearGradient>

        <LinearGradient id={`${id}-rain`} gradientUnits="userSpaceOnUse" x1="32" y1="44" x2="32" y2="60">
          <Stop offset="0%" stopColor="#7CC0F0" />
          <Stop offset="100%" stopColor="#2E6FA8" />
        </LinearGradient>

        {/* Blue enough to survive a light ground. Pure white flakes vanish on
            the light theme, which only shows up when both are compared. */}
        <LinearGradient id={`${id}-snow`} gradientUnits="userSpaceOnUse" x1="32" y1="44" x2="32" y2="60">
          <Stop offset="0%" stopColor="#EAF6FF" />
          <Stop offset="100%" stopColor="#8FC4EA" />
        </LinearGradient>

        <LinearGradient id={`${id}-bolt`} gradientUnits="userSpaceOnUse" x1="32" y1="34" x2="32" y2="60">
          <Stop offset="0%" stopColor="#FFE066" />
          <Stop offset="100%" stopColor="#F5C518" />
        </LinearGradient>
      </Defs>
      {children}
    </GradientIdContext.Provider>
  );
}
