"use client";

import { useState } from "react";

import { LocationSearch } from "@/components/location-search";
import type { LocationSearchResult } from "@/lib/location/search";

/** Saving the selection (commit 66) and switching the active location
 * (commit 67) land on top of this - for now selecting just confirms the
 * search itself works end to end. */
export default function LocationsPage() {
  const [selected, setSelected] = useState<LocationSearchResult | null>(null);

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-6 py-12">
      <h1 className="text-2xl font-semibold">Lokalizacje</h1>
      <LocationSearch onSelect={setSelected} />
      {selected && (
        <p className="text-sm text-muted-foreground">
          Wybrano: <span className="font-medium text-foreground">{selected.name}</span> (
          {selected.latitude.toFixed(2)}, {selected.longitude.toFixed(2)})
        </p>
      )}
    </div>
  );
}
