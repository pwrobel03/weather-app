import { describeAmendment, formatHourMinute, type AlertRevision, type Locale } from "@weather-app/core";

/**
 * One line saying what IMGW changed, above the warning it changed.
 *
 * Above rather than below, and one line rather than a history: somebody opens
 * a warning they have already seen once precisely to find out what moved, and
 * that answer should not be underneath the paragraph they already read.
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
    <p
      // Announced, because somebody reading this page with a screen reader is
      // asking the same question as everyone else: has this got worse.
      role="status"
      className={`rounded-lg px-3 py-2 text-sm ${
        amendment.escalated
          ? // The one case that borrows the warning vocabulary, and it is
            // borrowing it to say the warning itself got worse - which is the
            // only thing design.md §3 reserves it for.
            "bg-[color-mix(in_srgb,var(--dt-color-warning-3)_14%,transparent)] font-semibold text-foreground"
          : "bg-muted text-muted-foreground"
      }`}
    >
      {amendment.text}
    </p>
  );
}
