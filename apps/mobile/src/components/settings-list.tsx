import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

/**
 * The grouped list settings screens are made of.
 *
 * A settings screen is a list of decisions, and a list is what it should look
 * like. The previous version stacked loose bordered pills under loose labels,
 * which left nothing saying where one decision ended and the next began - the
 * grouping existed only in the spacing, and spacing is the first thing a long
 * screen loses.
 *
 * Cards rather than full-bleed rows: the app's own surfaces are inset and
 * rounded everywhere else (tiles, the alert card, the glass buttons), and a
 * settings screen that broke that would look borrowed from another app.
 */
export function Section({
  title,
  footer,
  children,
}: {
  title: string;
  /** Explains a control whose consequence is not visible from the control. */
  footer?: string;
  children: ReactNode;
}) {
  return (
    <View className="gap-2">
      <Text className="px-4 text-[11px] font-semibold uppercase tracking-[0.06em] text-tekst-muted">
        {title}
      </Text>

      <View className="overflow-hidden rounded-2xl border border-linia/10 bg-powierzchnia">
        {children}
      </View>

      {footer && <Text className="px-4 text-xs leading-5 text-tekst-muted">{footer}</Text>}
    </View>
  );
}

/**
 * One decision: what it is on the left, how it is set on the right.
 *
 * Falls to a stacked layout when the control is too wide to sit beside its
 * label - three options at a legible tap size do not fit next to "Prędkość
 * wiatru" on a small phone, and shrinking either is the wrong answer.
 */
export function Row({
  label,
  stacked = false,
  first = false,
  children,
}: {
  label: string;
  stacked?: boolean;
  /** Suppresses the divider, which belongs between rows and not above the first. */
  first?: boolean;
  children: ReactNode;
}) {
  return (
    <View className={`px-4 py-3 ${first ? "" : "border-t border-linia/10"}`}>
      <View
        className={stacked ? "gap-3" : "flex-row items-center justify-between gap-4"}
      >
        <Text className="text-sm text-tekst">{label}</Text>
        {children}
      </View>
    </View>
  );
}

/**
 * A choice among two or three, all of them visible.
 *
 * One track with a filled selection rather than separate outlined buttons: the
 * options are mutually exclusive, and a row of identical bordered boxes says
 * the opposite - it reads as several independent things that happen to be
 * adjacent.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  fill = false,
}: {
  options: { value: T; label: string }[];
  value: T | undefined;
  onChange: (value: T) => void;
  /** Spreads the options across the full width, for a stacked row. */
  fill?: boolean;
}) {
  return (
    <View className={`flex-row rounded-xl bg-linia/10 p-1 ${fill ? "" : "self-start"}`}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            // A floor on the width so that stacked rows line up: "°C" and
            // "km/h" are different lengths, and tracks sized to their contents
            // leave a ragged edge down the card.
            className={`rounded-lg px-3 py-1.5 active:opacity-70 ${
              fill ? "flex-1" : "min-w-[56px]"
            } ${selected ? "bg-primary" : ""}`}
          >
            <Text
              className={`text-center text-sm font-semibold ${
                selected ? "text-white" : "text-tekst-muted"
              }`}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
