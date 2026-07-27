"use client";

import { Trash2 } from "lucide-react";
import { useActionState, useState } from "react";

import { LocationSearch } from "@/components/location-search";
import { Button } from "@/components/ui/button";
import type { LocationSearchResult } from "@/lib/location/search";
import { deleteLocationAction, saveLocationAction, type SaveLocationActionState } from "@/lib/saved-locations/actions";
import type { SavedLocation } from "@/lib/saved-locations/api";

const initialState: SaveLocationActionState = {};

type SavedLocationsManagerProps = {
  locations: SavedLocation[];
};

/** Search (commit 65) picks a candidate; a small confirm step turns it into
 * a save so a stray click doesn't silently add a location. */
export function SavedLocationsManager({ locations }: SavedLocationsManagerProps) {
  const [pending, setPending] = useState<LocationSearchResult | null>(null);
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
          <li key={location.id} className="flex items-center justify-between py-2">
            <span className="text-sm font-medium">{location.name}</span>
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
