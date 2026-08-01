import { alertUiMessages, DEFAULT_LOCALE } from "@weather-app/core";

import { MapLegend } from "@/components/map/map-legend";
import { WarningMap } from "@/components/map/warning-map";
import { fetchActiveAlerts } from "@/lib/alerts/api";
import { fetchAllPowiatBoundaries } from "@/lib/map/boundaries";
import { resolveMapSeverity } from "@/lib/map/severity";
import { boundsForLocations } from "@/lib/map/style";
import { fetchSavedLocations } from "@/lib/saved-locations/api";

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
  const [boundaries, alerts, savedLocations] = await Promise.all([
    fetchAllPowiatBoundaries(),
    fetchActiveAlerts(),
    fetchSavedLocations(),
  ]);

  // A powiat can sit under several warnings at once; the map shows the worst
  // one. Averaging or last-wins would let a level 1 hide a level 3.
  const { severityByTeryt, alertsByTeryt, countsByLevel } = resolveMapSeverity(alerts);

  return (
    <main className="flex h-[100dvh] w-full flex-col gap-4 p-4 md:p-6">
      <h1 className="text-2xl font-bold tracking-tight">{labels.warnings}</h1>
      <div className="relative min-h-0 flex-1">
        <WarningMap
          label={labels.warnings}
          boundaries={boundaries}
          severityByTeryt={severityByTeryt}
          alertsByTeryt={alertsByTeryt}
          locale={locale}
          initialBounds={boundsForLocations(savedLocations)}
          className="size-full overflow-hidden rounded-[2rem] border border-border/60 shadow-md"
        />
        <MapLegend locale={locale} countsByLevel={countsByLevel} />
      </div>
    </main>
  );
}
