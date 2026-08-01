import {
  describeAmendment,
  formatHourMinute,
  type AlertRevision,
  type Locale,
} from "@weather-app/core";
import { tokens } from "@weather-app/design-tokens";
import { Text, View } from "react-native";

/**
 * One line saying what IMGW changed, above the warning it changed.
 *
 * Renders nothing when there has never been an amendment, which is most
 * warnings - an empty "no changes" row would be the loudest thing on a screen
 * about a storm.
 */
export function AmendmentNotice({
  revisions,
  severity,
  validTo,
  locale,
}: {
  revisions: AlertRevision[];
  severity: "1" | "2" | "3";
  validTo: string;
  locale: Locale;
}) {
  const amendment = describeAmendment(revisions, { severity, validTo }, locale, formatHourMinute);
  if (!amendment) return null;

  return (
    <View
      accessibilityRole="alert"
      className="rounded-xl px-3 py-2.5"
      style={{
        // The one case that borrows the warning vocabulary, and it borrows it
        // to say the warning itself got worse - which is the only thing
        // design.md §3 reserves it for.
        backgroundColor: amendment.escalated ? `${tokens.colors.warning3}24` : undefined,
      }}
    >
      <Text
        className={`text-sm ${amendment.escalated ? "font-semibold text-tekst" : "text-tekst-muted"}`}
      >
        {amendment.text}
      </Text>
    </View>
  );
}
