import { alertUiMessages, DEFAULT_LOCALE } from "@weather-app/core";

import { WarningMap } from "@/components/map/warning-map";

export const dynamic = "force-dynamic";

/**
 * The warning map.
 *
 * A page of its own rather than a tile on the home screen: it is the one view
 * that wants the whole viewport, and the home screen's job is "what is
 * happening here", not "what is happening everywhere".
 */
export default function MapPage() {
  const locale = DEFAULT_LOCALE;
  const labels = alertUiMessages[locale];

  return (
    <main className="flex h-[100dvh] w-full flex-col gap-4 p-4 md:p-6">
      <h1 className="text-2xl font-bold tracking-tight">{labels.warnings}</h1>
      <WarningMap
        label={labels.warnings}
        className="min-h-0 flex-1 overflow-hidden rounded-[2rem] border border-border/60 shadow-md"
      />
    </main>
  );
}
