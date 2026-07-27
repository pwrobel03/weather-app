"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { searchLocations, type LocationSearchResult } from "@/lib/location/search";
import { useDebouncedValue } from "@/lib/use-debounced-value";

type LocationSearchProps = {
  onSelect: (location: LocationSearchResult) => void;
  placeholder?: string;
};

/** Backend already no-ops queries under 2 characters (commit 20's
 * LocationService) - matching that here too avoids firing a request that's
 * guaranteed to come back empty. */
const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 300;

function formatSubtitle(result: LocationSearchResult): string {
  return [result.admin1, result.country].filter(Boolean).join(", ");
}

export function LocationSearch({ onSelect, placeholder = "Szukaj miejscowości…" }: LocationSearchProps) {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, DEBOUNCE_MS);
  const trimmed = debouncedQuery.trim();

  const { data: results, isFetching } = useQuery({
    queryKey: ["location-search", trimmed],
    queryFn: () => searchLocations(trimmed),
    enabled: trimmed.length >= MIN_QUERY_LENGTH,
  });

  return (
    <div className="flex flex-col gap-2">
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={placeholder}
        aria-label="Szukaj miejscowości"
        className="rounded-lg border border-border bg-background px-3 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      {trimmed.length >= MIN_QUERY_LENGTH && (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border empty:hidden">
          {isFetching && results === undefined ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">Szukam…</li>
          ) : results && results.length > 0 ? (
            results.map((result) => (
              <li key={result.id}>
                <button
                  type="button"
                  onClick={() => onSelect(result)}
                  className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-muted"
                >
                  <span className="text-sm font-medium">{result.name}</span>
                  <span className="text-xs text-muted-foreground">{formatSubtitle(result)}</span>
                </button>
              </li>
            ))
          ) : (
            <li className="px-3 py-2 text-sm text-muted-foreground">Brak wyników.</li>
          )}
        </ul>
      )}
    </div>
  );
}
