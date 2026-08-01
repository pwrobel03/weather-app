import {
  alertMessages,
  alertUiMessages,
  formatValidity,
  listFormat,
  type Locale,
  phenomenonName,
} from "@weather-app/core";
import { tokens } from "@weather-app/design-tokens";
import { Text, View } from "react-native";

import type { ActiveAlert } from "../lib/alerts";

/**
 * One warning in a timeline.
 *
 * Severity is a signal here, so it never rides on colour alone: the coloured
 * bar always sits next to the level written out in words (design.md §3). That
 * is what keeps the timeline readable for anyone who cannot separate the three
 * IMGW hues - and on a phone held in sunlight, that is most people.
 *
 * The surface is opaque by rule, never glass: it is the one thing in the app
 * that must stay legible over a shifting gradient.
 */
export function AlertEntry({
  alert,
  locale,
  now,
  detailed = false,
}: {
  alert: ActiveAlert;
  locale: Locale;
  now: Date;
  /** Shows IMGW's full text and metadata, as on the detail screen. */
  detailed?: boolean;
}) {
  const messages = alertMessages[locale];
  const labels = alertUiMessages[locale];
  const expired = new Date(alert.validTo).getTime() < now.getTime();
  const severityColor = tokens.colors[`warning${alert.severity}`];

  return (
    <View
      // One node, one sentence. Left to itself the card reads as six fragments
      // in layout order, with the severity arriving somewhere after the event
      // name and the punctuation between them announced as words.
      accessible
      accessibilityLabel={[
        messages.severityLabel[alert.severity],
        phenomenonName(alert.event, locale),
        expired ? labels.expired : null,
        `${labels.from} ${formatValidity(alert.validFrom, locale)}`,
        alert.affectedLocations.length > 0
          ? `${messages.affects}: ${listFormat(
              alert.affectedLocations.map((location) => location.name),
              locale,
            )}`
          : null,
      ]
        .filter(Boolean)
        .join(". ")}
      className="flex-row gap-3 rounded-2xl bg-powierzchnia p-4"
      style={{ opacity: expired ? 0.62 : 1 }}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        className="w-1 rounded-full"
        style={{ backgroundColor: severityColor }}
      />

      <View className="min-w-0 flex-1 gap-1.5">
        <View className="flex-row flex-wrap items-center gap-x-2 gap-y-1">
          <Text className="text-base font-semibold text-tekst">
            {phenomenonName(alert.event, locale)}
          </Text>
          {/* Text ink rather than the severity colour - level 3 measures
              4.13:1 on this surface, under the floor for text this size. The
              bar down the left carries the colour instead. */}
          <Text className="text-xs font-semibold text-tekst">
            {messages.severityLabel[alert.severity]}
          </Text>
          {expired && (
            <Text className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-tekst-muted">
              {labels.expired}
            </Text>
          )}
        </View>

        <Text className="text-xs text-tekst-muted">
          {labels.from} {formatValidity(alert.validFrom, locale)} ·{" "}
          {messages.inForceUntil.toLowerCase()} {formatValidity(alert.validTo, locale)}
        </Text>

        {alert.affectedLocations.length > 0 && (
          <Text className="text-xs text-tekst-muted">
            {messages.affects}:{" "}
            {listFormat(
              alert.affectedLocations.map((location) => location.name),
              locale,
            )}
          </Text>
        )}

        {detailed && (
          <>
            {typeof alert.probabilityPercent === "number" && (
              <Text className="text-xs text-tekst-muted">
                {labels.probability}: {alert.probabilityPercent}%
              </Text>
            )}
            {alert.content && (
              <Text className="mt-1 text-sm leading-relaxed text-tekst">{alert.content}</Text>
            )}
            {alert.comment && alert.comment !== "Brak." && (
              <Text className="text-sm text-tekst-muted">{alert.comment}</Text>
            )}
            <Text className="mt-1 text-[11px] text-tekst-muted">
              {messages.source}
              {alert.office ? ` · ${alert.office}` : ""}
              {locale === "en" && alert.content ? ` · ${messages.originalLanguageNote}` : ""}
            </Text>
          </>
        )}
      </View>
    </View>
  );
}
