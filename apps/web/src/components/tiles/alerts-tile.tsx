import Link from "next/link";
import { ShieldCheck, TriangleAlert } from "lucide-react";

import { Tile } from "@/components/tiles/tile";
import { Button } from "@/components/ui/button";
import { alertMessages, formatValidity, listFormat, type Locale } from "@/lib/i18n/messages";
import type { ActiveAlert } from "@/lib/alerts/api";

const LABELS: Record<
  Locale,
  { title: string; none: string; anonymous: string; signIn: string; remaining: string }
> = {
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
 * Warnings in force for the user's saved locations.
 *
 * Sized by importance, not by convenience. A measurement of the previous
 * layout found this the *smallest* tile on a screen whose entire reason for
 * existing is IMGW warnings, while the saved-places list - looked at once
 * during setup - was nearly twice its area. Now it is the tall right-hand
 * column, and each warning is a full entry rather than four lines of small
 * type.
 *
 * The quiet state is genuinely quiet: with nothing in force it collapses to a
 * single line instead of holding a large empty box open.
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
  // Anything without warnings to show collapses, including the signed-out
  // prompt - a large empty box holds space open for nothing.
  const quiet = alerts.length === 0;

  return (
    <Tile
      title={labels.title}
      variant="glass"
      className={quiet ? undefined : "h-full"}
      aside={
        alerts.length > 0 ? (
          <span className="font-mono text-2xl leading-none font-light tabular-nums">
            {alerts.length}
          </span>
        ) : null
      }
    >
      {!authenticated ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm opacity-75">{labels.anonymous}</p>
          <Button render={<Link href="/login" />} nativeButton={false} variant="glass" size="sm">
            {labels.signIn}
          </Button>
        </div>
      ) : quiet ? (
        <div className="flex items-center gap-2">
          <ShieldCheck aria-hidden="true" className="size-4 opacity-60" />
          <p className="text-sm opacity-75">{labels.none}</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-4">
          {alerts.map((alert) => {
            const remaining = formatRemaining(alert.validTo, now, locale);
            const colour = `var(--dt-color-warning-${alert.severity})`;
            return (
              <li key={alert.id}>
                <Link
                  href={`/alerts/${alert.id}`}
                  className="flex gap-3 rounded-xl outline-offset-4 transition-opacity hover:opacity-80"
                >
                  {/* Severity is a signal, so it never rides on colour alone:
                      the bar always travels with the level in words and an
                      icon (design.md §3). */}
                  <span
                    aria-hidden="true"
                    className="w-1 shrink-0 rounded-full"
                    style={{ background: colour }}
                  />
                  <div className="flex min-w-0 flex-col gap-1">
                    <p className="text-base leading-tight font-semibold">{alert.event}</p>
                    <p
                      className="flex items-center gap-1.5 text-xs font-semibold"
                      style={{ color: colour }}
                    >
                      <TriangleAlert aria-hidden="true" className="size-3.5" />
                      {messages.severityLabel[alert.severity]}
                    </p>
                    {alert.affectedLocations.length > 0 && (
                      <p className="truncate text-xs opacity-70">
                        {listFormat(alert.affectedLocations.map((l) => l.name), locale)}
                      </p>
                    )}
                    <p className="font-mono text-lg leading-none font-light tabular-nums">
                      {remaining ?? formatValidity(alert.validTo, locale)}
                      {remaining && (
                        <span className="ml-1.5 font-sans text-[0.625rem] tracking-wide uppercase opacity-60">
                          {labels.remaining}
                        </span>
                      )}
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
