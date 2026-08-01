import { projectShapes, type Locale } from "@weather-app/core";
import { tokens } from "@weather-app/design-tokens";
import { Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import type { PowiatFeature } from "../lib/boundaries";

const SIZE = 100;

/**
 * The mobile map: a still picture of the powiats that concern this user,
 * filled where a warning is in force.
 *
 * No map library, deliberately. The web map earns MapLibre by panning,
 * zooming, clicking a powiat and reading its warnings; none of that is on this
 * screen, and a native map module would be a build-breaking dependency and
 * several megabytes to draw shapes we already have the coordinates for. The
 * same reasoning the powiat tile was built on, now with more than one shape.
 *
 * All shapes share one frame (projectShapes in @weather-app/core), because the
 * only thing a multi-powiat picture says is where they sit relative to each
 * other - fitting each to its own box would erase exactly that.
 */
export function PowiatMap({
  features,
  severityByTeryt,
  locale,
  emptyLabel,
}: {
  features: PowiatFeature[];
  severityByTeryt: Record<string, "1" | "2" | "3">;
  locale: Locale;
  emptyLabel: string;
}) {
  const shapes = projectShapes(features, SIZE);

  if (shapes.length === 0) {
    return <Text className="text-sm text-tekst-muted">{emptyLabel}</Text>;
  }

  const warned = shapes.filter((shape) => severityByTeryt[shape.terytCode]);

  return (
    <View className="gap-3">
      <Svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        width="100%"
        height={260}
        accessibilityRole="image"
        aria-label={label(warned.length, locale)}
      >
        {shapes.map((shape) => {
          const severity = severityByTeryt[shape.terytCode];
          return (
            <Path
              key={shape.terytCode}
              d={shape.d}
              fill={severity ? tokens.colors[`warning${severity}`] : tokens.colors.powierzchnia}
              fillOpacity={severity ? 0.85 : 0.6}
              stroke={tokens.colors.tekstMuted}
              strokeOpacity={0.5}
              strokeWidth={0.4}
              strokeLinejoin="round"
            />
          );
        })}
      </Svg>

      {/* The shapes are unlabelled - names would be illegible at this size -
          so the list below is how a reader learns which is which, and it is
          also what keeps severity from resting on colour alone. */}
      <View className="gap-1">
        {shapes.map((shape) => (
          <View key={shape.terytCode} className="flex-row items-center gap-2">
            <View
              className="size-2.5 rounded-full"
              style={{
                backgroundColor: severityByTeryt[shape.terytCode]
                  ? tokens.colors[`warning${severityByTeryt[shape.terytCode]!}`]
                  : tokens.colors.tekstMuted,
              }}
            />
            <Text className="flex-1 text-sm text-tekst" numberOfLines={1}>
              {shape.name}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function label(warnedCount: number, locale: Locale): string {
  return locale === "pl"
    ? `Mapa powiatów, objętych ostrzeżeniem: ${warnedCount}`
    : `Map of counties, ${warnedCount} under a warning`;
}
