import { alertUiMessages, DEFAULT_LOCALE } from "@weather-app/core";

import { WarningMap } from "@/components/map/warning-map";
import { fetchActiveAlerts } from "@/lib/alerts/api";
import { fetchAllPowiatBoundaries } from "@/lib/map/boundaries";

export const dynamic = "force-dynamic";

/**
 * The warning map.
 *
 * A page of its own rather than a tile on the home screen: it is the one view
 * that wants the whole viewport, and the home screen's job is "what is
 * happening here", not "what is happening everywhere".
 */
export default async function MapPage() {
  const locale = DEFAULT_LOCALE;
  const labels = alertUiMessages[locale];
  const [boundaries, alerts] = await Promise.all([
    fetchAllPowiatBoundaries(),
    fetchActiveAlerts(),
  ]);

  // A powiat can sit under several warnings at once; the map shows the worst
  // one. Averaging or last-wins would let a level 1 hide a level 3.
  const severityByTeryt: Record<string, "1" | "2" | "3"> = {};
  for (const alert of alerts) {
    for (const terytCode of alert.terytCodes) {
      const current = severityByTeryt[terytCode];
      if (!current || Number(alert.severity) > Number(current)) {
        severityByTeryt[terytCode] = alert.severity;
      }
    }
  }

  return (
    <main className="flex h-[100dvh] w-full flex-col gap-4 p-4 md:p-6">
      <h1 className="text-2xl font-bold tracking-tight">{labels.warnings}</h1>
      <WarningMap
        label={labels.warnings}
        boundaries={boundaries}
        severityByTeryt={severityByTeryt}
        className="min-h-0 flex-1 overflow-hidden rounded-[2rem] border border-border/60 shadow-md"
      />
    </main>
  );
}
