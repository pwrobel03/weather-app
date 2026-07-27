import { TriangleAlert } from "lucide-react";

import type { ActiveAlert } from "@/lib/alerts/api";
import { alertMessages, formatValidity, listFormat, type Locale } from "@/lib/i18n/messages";

const LABELS: Record<Locale, { from: string; expired: string; probability: string }> = {
  pl: { from: "Od", expired: "Zakończone", probability: "Prawdopodobieństwo" },
  en: { from: "From", expired: "Expired", probability: "Probability" },
};

/**
 * One warning in a timeline.
 *
 * Severity is a signal here, so it never rides on colour alone: the coloured
 * bar is always accompanied by the level as words and by an icon
 * (design.md §3). That is also what keeps the timeline readable for anyone who
 * cannot separate the three IMGW hues.
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
  /** Shows IMGW's full text and metadata, as on the detail page. */
  detailed?: boolean;
}) {
  const messages = alertMessages[locale];
  const labels = LABELS[locale];
  const expired = new Date(alert.validTo).getTime() < now.getTime();
  const severityColor = `var(--dt-color-warning-${alert.severity})`;

  return (
    <article
      className="relative flex gap-4 rounded-2xl bg-card p-4 text-card-foreground"
      // The alert surface is opaque by rule, never glass (design.md §4).
      style={{ opacity: expired ? 0.62 : 1 }}
    >
      <span
        aria-hidden="true"
        className="w-1 shrink-0 rounded-full"
        style={{ background: severityColor }}
      />

      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <TriangleAlert aria-hidden="true" className="size-4" style={{ color: severityColor }} />
          <h3 className="text-base font-semibold">{alert.event}</h3>
          <span className="text-xs font-semibold" style={{ color: severityColor }}>
            {messages.severityLabel[alert.severity]}
          </span>
          {expired && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[0.625rem] text-muted-foreground">
              {labels.expired}
            </span>
          )}
        </div>

        <p className="font-mono text-xs tabular-nums text-muted-foreground">
          {labels.from} {formatValidity(alert.validFrom, locale)} ·{" "}
          {messages.inForceUntil.toLowerCase()} {formatValidity(alert.validTo, locale)}
        </p>

        {alert.affectedLocations.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {messages.affects}: {listFormat(alert.affectedLocations.map((l) => l.name), locale)}
          </p>
        )}

        {detailed && (
          <>
            {typeof alert.probabilityPercent === "number" && (
              <p className="font-mono text-xs tabular-nums text-muted-foreground">
                {labels.probability}: {alert.probabilityPercent}%
              </p>
            )}
            {alert.content && (
              <p className="mt-1 text-sm leading-relaxed" lang="pl">
                {alert.content}
              </p>
            )}
            {alert.comment && alert.comment !== "Brak." && (
              <p className="text-sm text-muted-foreground" lang="pl">
                {alert.comment}
              </p>
            )}
            <p className="mt-1 text-[0.6875rem] text-muted-foreground">
              {messages.source}
              {alert.office ? ` · ${alert.office}` : ""}
              {locale === "en" && alert.content ? ` · ${messages.originalLanguageNote}` : ""}
            </p>
          </>
        )}
      </div>
    </article>
  );
}
