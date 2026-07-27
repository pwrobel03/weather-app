import Link from "next/link";
import { ShieldCheck, TriangleAlert } from "lucide-react";

import { Tile } from "@/components/tiles/tile";
import { Button } from "@/components/ui/button";
import { alertMessages, formatValidity, listFormat, type Locale } from "@/lib/i18n/messages";
import type { ActiveAlert } from "@/lib/alerts/api";

const LABELS: Record<Locale, { title: string; none: string; anonymous: string; signIn: string; remaining: string }> = {
  pl: {
    title: "Ostrzeżenia",
    none: "Brak ostrzeżeń dla Twoich lokalizacji",
    anonymous: "Zaloguj się, aby obserwować ostrzeżenia dla swoich miejsc",
    signIn: "Zaloguj się",
    remaining: "Pozostało",
  },
  en: {
    title: "Warnings",
    none: "No warnings for your locations",
    anonymous: "Sign in to watch warnings for your places",
    signIn: "Sign in",
    remaining: "Remaining",
  },
};

/** "6 h 20 min" / "20 min" - coarse on purpose, this is not a stopwatch. */
function formatRemaining(validTo: string, now: Date, locale: Locale): string | null {
  const minutes = Math.round((new Date(validTo).getTime() - now.getTime()) / 60000);
  if (minutes <= 0) return null;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return locale === "pl" ? `${hours} h ${rest} min` : `${hours}h ${rest}m`;
}

/**
 * Warnings in force for the user's saved locations, with how much longer each
 * one lasts.
 *
 * The remaining time is computed from validTo, which the payload already
 * carries - it is the single most useful thing to say about a warning after
 * its severity, and the API needed no change to provide it.
 *
 * Severity here is a signal, so it never appears as colour alone: every entry
 * carries the level as text and an icon alongside the colour (design.md §3).
 */
export function AlertsTile({
  alerts,
  authenticated,
  locale,
  now,
}: {
  alerts: ActiveAlert[];
  authenticated: boolean;
  locale: Locale;
  /** Injected so the render is deterministic and the React Compiler stays happy. */
  now: Date;
}) {
  const labels = LABELS[locale];
  const messages = alertMessages[locale];

  return (
    <Tile
      title={labels.title}
      aside={
        alerts.length > 0 ? (
          <span className="on-glass font-mono text-sm tabular-nums">{alerts.length}</span>
        ) : null
      }
    >
      {!authenticated ? (
        <div className="flex flex-col items-start gap-3">
          <p className="on-glass-muted text-sm">{labels.anonymous}</p>
          <Button render={<Link href="/login" />} nativeButton={false} variant="glass" size="sm">
            {labels.signIn}
          </Button>
        </div>
      ) : alerts.length === 0 ? (
        <div className="flex items-center gap-2">
          <ShieldCheck aria-hidden="true" className="size-4 opacity-70" />
          <p className="on-glass-muted text-sm">{labels.none}</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {alerts.map((alert) => {
            const remaining = formatRemaining(alert.validTo, now, locale);
            return (
              <li key={alert.id}>
                <Link href={`/alerts/${alert.id}`} className="flex items-start gap-3 rounded-xl outline-offset-4">
                <TriangleAlert
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0"
                  style={{ color: `var(--dt-color-warning-${alert.severity})` }}
                />
                <div className="flex min-w-0 flex-col gap-0.5">
                  <p className="on-glass text-sm font-semibold">{alert.event}</p>
                  <p
                    className="text-xs font-semibold"
                    style={{ color: `var(--dt-color-warning-${alert.severity})` }}
                  >
                    {messages.severityLabel[alert.severity as "1" | "2" | "3"]}
                  </p>
                  {alert.affectedLocations.length > 0 && (
                    <p className="on-glass-muted truncate text-xs">
                      {messages.affects}: {listFormat(alert.affectedLocations.map((l) => l.name), locale)}
                    </p>
                  )}
                  <p className="on-glass-muted font-mono text-xs tabular-nums">
                    {remaining
                      ? `${labels.remaining} ${remaining}`
                      : `${messages.inForceUntil} ${formatValidity(alert.validTo, locale)}`}
                  </p>
                </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Tile>
  );
}
