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
      className="h-full flex flex-col justify-between"
      aside={
        alerts.length > 0 ? (
          <span className="inline-flex items-center justify-center rounded-full bg-destructive/20 px-2.5 py-0.5 font-mono text-xs font-bold text-destructive ring-1 ring-destructive/30 tabular-nums animate-pulse-subtle">
            {alerts.length}
          </span>
        ) : null
      }
    >
      {!authenticated ? (
        <div className="flex flex-col items-start justify-center gap-4 rounded-2xl border border-black/15 dark:border-white/15 p-4 backdrop-blur-md">
          <p className="text-sm font-medium opacity-90">{labels.anonymous}</p>
          <Button render={<Link href="/login" />} nativeButton={false} variant="glass" size="sm" className="w-full justify-center shadow-sm">
            {labels.signIn}
          </Button>
        </div>
      ) : quiet ? (
        <div className="flex items-center gap-3.5 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-foreground shadow-xs backdrop-blur-sm transition-[transform,box-shadow,border-color] duration-[200ms] hover:border-emerald-500/40 hover:shadow-sm">
          <div className="relative flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-25 animate-pulse-subtle" />
            <ShieldCheck aria-hidden="true" className="relative size-5" />
          </div>
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-semibold tracking-tight">{labels.none}</p>
            <p className="text-[0.7rem] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 opacity-90">Status: Bezpiecznie</p>
          </div>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {alerts.map((alert) => {
            const remaining = formatRemaining(alert.validTo, now, locale);
            const colour = `var(--dt-color-warning-${alert.severity})`;
            return (
              <li key={alert.id}>
                <Link
                  href={`/alerts/${alert.id}`}
                  className="group/alert relative flex gap-3.5 rounded-2xl border border-border/50 bg-black/20 p-4 backdrop-blur-md outline-offset-4 transition-[transform,background-color,border-color,box-shadow] duration-[200ms] ease-[cubic-bezier(0.23,1,0.32,1)] hover:scale-[1.02] hover:border-white/30 hover:bg-black/35 hover:shadow-md active:scale-[0.97] dark:bg-white/5 dark:hover:bg-white/10"
                >
                  <span
                    aria-hidden="true"
                    className="w-1.5 shrink-0 rounded-full shadow-sm"
                    style={{ background: colour }}
                  />
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-base leading-tight font-bold tracking-tight text-white">{alert.event}</p>
                      <span
                        className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[0.7rem] font-bold uppercase tracking-wider text-white bg-black/30 shadow-xs"
                        style={{ borderColor: colour, borderWidth: "1px" }}
                      >
                        <TriangleAlert aria-hidden="true" className="size-3" style={{ color: colour }} />
                        {messages.severityLabel[alert.severity]}
                      </span>
                    </div>
                    {alert.affectedLocations.length > 0 && (
                      <p className="truncate text-xs text-white/80 font-medium">
                        {listFormat(alert.affectedLocations.map((l) => l.name), locale)}
                      </p>
                    )}
                    <div className="mt-1 flex items-baseline justify-between pt-2 border-t border-white/10">
                      <p className="font-mono text-base leading-none font-semibold tabular-nums text-white">
                        {remaining ?? formatValidity(alert.validTo, locale)}
                        {remaining && (
                          <span className="ml-2 font-sans text-[0.65rem] font-semibold tracking-wider uppercase text-white/70">
                            {labels.remaining}
                          </span>
                        )}
                      </p>
                    </div>
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
