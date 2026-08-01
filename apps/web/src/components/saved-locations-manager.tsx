"use client";

import { Trash2 } from "lucide-react";
import { useActionState, useState, useTransition } from "react";

import { appMessages, type Locale } from "@weather-app/core";

import { LocationSearch } from "@/components/location-search";
import { Button } from "@/components/ui/button";
import type { LocationSearchResult } from "@/lib/location/search";
import {
  deleteLocationAction,
  saveLocationAction,
  updateMinSeverityAction,
  type SaveLocationActionState,
} from "@/lib/saved-locations/actions";
import type { SavedLocation } from "@/lib/saved-locations/api";

const initialState: SaveLocationActionState = {};

type SavedLocationsManagerProps = {
  locations: SavedLocation[];
  locale: Locale;
};

/** Search (commit 65) picks a candidate; a small confirm step turns it into
 * a save so a stray click doesn't silently add a location. */
export function SavedLocationsManager({ locations, locale }: SavedLocationsManagerProps) {
  const [pending, setPending] = useState<LocationSearchResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const [state, formAction, isSaving] = useActionState(saveLocationAction, initialState);

  return (
    <div className="flex flex-col gap-6">
      <LocationSearch onSelect={setPending} />

      {pending && (
        <form action={formAction} className="flex items-center gap-3 rounded-lg border border-border p-3">
          <input type="hidden" name="name" value={pending.name} />
          <input type="hidden" name="latitude" value={pending.latitude} />
          <input type="hidden" name="longitude" value={pending.longitude} />
          <p className="flex-1 text-sm">
            Dodać <span className="font-medium">{pending.name}</span> do zapisanych lokalizacji?
          </p>
          <Button type="submit" size="sm" disabled={isSaving}>
            {isSaving ? "Zapisywanie…" : "Dodaj"}
          </Button>
        </form>
      )}
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <ul className="flex flex-col divide-y divide-border">
        {locations.length === 0 && (
          <li className="py-2 text-sm text-muted-foreground">Brak zapisanych lokalizacji.</li>
        )}
        {locations.map((location) => (
          <li key={location.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <span className="text-sm font-medium">{location.name}</span>

            {/* On the place it governs rather than in settings: the answer to
                "and what about the allotment" belongs on the allotment's row. */}
            <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
              {appMessages[locale].notifyFrom}
              <select
                value={location.minSeverity}
                onChange={(event) =>
                  startTransition(() =>
                    updateMinSeverityAction(
                      location.id,
                      event.target.value as "1" | "2" | "3",
                    ),
                  )
                }
                disabled={isPending}
                className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
              >
                {(["1", "2", "3"] as const).map((level) => (
                  <option key={level} value={level}>
                    {appMessages[locale].notifyFromLevel[level]}
                  </option>
                ))}
              </select>
            </label>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Usuń ${location.name}`}
              onClick={async () => {
                await deleteLocationAction(location.id);
              }}
            >
              <Trash2 />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
