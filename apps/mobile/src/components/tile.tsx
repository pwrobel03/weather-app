import type { ReactNode } from "react";
import { Text, View } from "react-native";

type TileProps = {
  title?: string;
  /** Shown right of the title - a count, a unit, a link. */
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
};

/**
 * A section on the home screen.
 *
 * Deliberately bare - a title and its content, no card chrome. That is exactly
 * what apps/web's Tile renders below the `lg` breakpoint: the border, surface
 * and shadow are desktop-only there, because on a narrow screen a stack of
 * outlined boxes reads as clutter and the gradient hero is already carrying
 * all the visual weight the screen can hold.
 */
export function Tile({ title, aside, className, children }: TileProps) {
  return (
    <View className={`gap-3 px-4 py-5 ${className ?? ""}`}>
      {(title || aside) && (
        <View className="flex-row items-center justify-between gap-3 px-1">
          {title ? <Text className="text-xl font-bold text-tekst">{title}</Text> : <View />}
          {aside}
        </View>
      )}
      {children}
    </View>
  );
}
