"use client";

import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, ChevronLeft, ChevronRight, LayoutGrid, MapPin, Moon, RefreshCw, Search, Settings, Sun, User } from "lucide-react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useEffect, useState, useTransition } from "react";

import { HeroContent } from "@/components/hero-content";
import { LocationSearch } from "@/components/location-search";
import { Button } from "@/components/ui/button";
import { setActiveLocationAction } from "@/lib/active-location/actions";
import type { ActiveLocation } from "@/lib/active-location/cookie";
import type { Locale } from "@weather-app/core";
import type { SavedLocation } from "@/lib/saved-locations/api";
import type { CurrentConditions } from "@/lib/weather/current-conditions";

type CurrentConditionsClientProps = {
  latitude: number;
  longitude: number;
  locale: Locale;
  /** Hour at the displayed location, computed on the server so the first paint
   * matches and hydration does not disagree about what time it is. */
  localHour: number;
  /** Seeds the query so first paint is still the server-rendered value -
   * this component only takes over for refetches after that. Undefined when
   * the server-side fetch itself failed; the query then fetches on mount. */
  initialData?: CurrentConditions;
  /** Currently active location item */
  active?: ActiveLocation;
  /** User saved locations array */
  savedLocations?: SavedLocation[];
  /** Authentication session state */
  authenticated?: boolean;
};

async function fetchViaProxy(latitude: number, longitude: number): Promise<CurrentConditions> {
  const response = await fetch(`/api/forecast/current?latitude=${latitude}&longitude=${longitude}`);
  if (!response.ok) {
    throw new Error(`forecast refresh failed: ${response.status}`);
  }
  return response.json();
}

/** The one interactive fragment on the home screen (roadmap commit 62) - the
 * rest of the page stays plain RSC. Includes unified Screen 1 navigation header. */
export function CurrentConditionsClient({
  latitude,
  longitude,
  locale,
  localHour,
  initialData,
  active,
  savedLocations = [],
  authenticated = false,
}: CurrentConditionsClientProps) {
  const { data, refetch, isFetching, isError } = useQuery({
    queryKey: ["current-conditions", latitude, longitude],
    queryFn: () => fetchViaProxy(latitude, longitude),
    initialData,
  });

  const [isOnline, setIsOnline] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    const updateOnlineStatus = () => setIsOnline(navigator.onLine);
    updateOnlineStatus();
    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);
    return () => {
      window.removeEventListener("online", updateOnlineStatus);
      window.removeEventListener("offline", updateOnlineStatus);
    };
  }, []);

  function handleSelectLocation(loc: ActiveLocation) {
    setMenuOpen(false);
    setShowSearch(false);
    startTransition(() => {
      void setActiveLocationAction(loc);
    });
  }

  const isOfflineState = !isOnline || isError;

  const topNav = (
    <header className="absolute top-0 left-0 right-0 z-40 flex items-center justify-between p-4 sm:p-6 pointer-events-auto">
      {/* LEFT: Compact Dropdown Action Menu (Location, Account, Theme Toggle) to keep main screen uncluttered */}
      <div className="relative">
        <Button
          variant="glass"
          size="icon-sm"
          aria-label="Menu opcji aplikacji"
          aria-expanded={menuOpen}
          onClick={() => {
            setMenuOpen(!menuOpen);
            if (menuOpen) setShowSearch(false);
          }}
          className="size-10 sm:size-11 rounded-full micro-press shadow-sm hover:border-white/35 transition-all"
        >
          <LayoutGrid className="size-4.5 sm:size-5 text-white/90" />
        </Button>

        {/* Sleek Dark Glass Popover Menu */}
        {menuOpen && (
          <div className="absolute top-full left-0 mt-3 w-72 sm:w-80 rounded-2xl border border-white/20 bg-[#0e131d]/95 p-3.5 text-white shadow-[0_20px_60px_rgba(0,0,0,0.8)] backdrop-blur-2xl z-50 animate-in fade-in zoom-in-95 duration-200">
            {/* Location selector section */}
            <div className="mb-3 pb-3 border-b border-white/15">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-white/60 mb-2">
                <span>Lokalizacja</span>
                <button
                  type="button"
                  onClick={() => setShowSearch(!showSearch)}
                  className="text-sky-400 hover:underline inline-flex items-center gap-1 font-sans text-xs font-medium lowercase first-letter:uppercase"
                >
                  <Search className="size-3" />
                  {showSearch ? "zamknij" : "szukaj miasta"}
                </button>
              </div>

              {showSearch && (
                <div className="my-2.5">
                  <LocationSearch
                    onSelect={(result) =>
                      handleSelectLocation({
                        savedLocationId: null,
                        name: result.name,
                        latitude: result.latitude,
                        longitude: result.longitude,
                      })
                    }
                  />
                </div>
              )}

              {savedLocations.length > 0 && (
                <ul className="max-h-40 overflow-y-auto space-y-1 my-1 pr-1">
                  {savedLocations.map((loc) => {
                    const isCurrentLoc = active?.name === loc.name;
                    return (
                      <li key={loc.id}>
                        <button
                          type="button"
                          onClick={() =>
                            handleSelectLocation({
                              savedLocationId: loc.id,
                              name: loc.name,
                              latitude: loc.latitude,
                              longitude: loc.longitude,
                            })
                          }
                          disabled={isPending}
                          className={`w-full flex items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                            isCurrentLoc
                              ? "bg-white/15 font-bold text-white shadow-inner"
                              : "text-white/80 hover:bg-white/10 hover:text-white"
                          }`}
                        >
                          <span className="truncate">{loc.name}</span>
                          {isCurrentLoc && <Check className="size-4 text-sky-400 shrink-0 ml-2" />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              {savedLocations.length === 0 && !showSearch && (
                <button
                  type="button"
                  onClick={() => setShowSearch(true)}
                  className="w-full text-left py-1.5 text-xs font-medium text-white/80 hover:text-white inline-flex items-center gap-1.5"
                >
                  <MapPin className="size-3.5 text-sky-400 shrink-0" />
                  <span>Wyszukaj miasto lub zmień lokalizację...</span>
                </button>
              )}
            </div>

            {/* Authentication and settings section */}
            <div className="mb-3 pb-3 border-b border-white/15">
              {authenticated ? (
                <Link
                  href="/settings"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2.5 px-2.5 py-2 text-sm font-medium text-white/90 rounded-xl hover:bg-white/10 transition-colors"
                >
                  <Settings className="size-4 text-sky-400" />
                  <span>Ustawienia konta</span>
                </Link>
              ) : (
                <Link
                  href="/login"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2.5 px-2.5 py-2 text-sm font-medium text-white/90 rounded-xl hover:bg-white/10 transition-colors"
                >
                  <User className="size-4 text-sky-400" />
                  <span>Zaloguj się</span>
                </Link>
              )}
            </div>

            {/* Theme Toggle control */}
            <div>
              <button
                type="button"
                onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
                className="w-full flex items-center justify-between gap-2 px-2.5 py-2 text-sm font-medium text-white/90 rounded-xl hover:bg-white/10 transition-colors"
              >
                <span className="flex items-center gap-2.5">
                  {resolvedTheme === "dark" ? (
                    <Sun className="size-4 text-amber-400" />
                  ) : (
                    <Moon className="size-4 text-sky-400" />
                  )}
                  <span>Motyw aplikacji</span>
                </span>
                <span className="text-[0.7rem] font-bold text-sky-300 uppercase tracking-wider px-2 py-0.5 rounded bg-white/10 border border-white/15">
                  {resolvedTheme === "dark" ? "Ciemny" : "Jasny"}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* CENTER: Prominent City Location Title (Screen 1 aesthetic) */}
      <div className="absolute left-1/2 -translate-x-1/2 top-4 sm:top-6 flex items-center justify-center gap-1 text-center pointer-events-auto">
        {/* One click per place, matching the swipe on mobile. The menu below
            still holds the full list and the search - this is for the common
            case, which is two or three places and a step between them. A
            keyboard reaches these as ordinary buttons, which a swipe never
            offered anyone. */}
        <StepPlace
          direction="previous"
          places={savedLocations}
          active={active}
          disabled={isPending}
          onSelect={handleSelectLocation}
        />

        <button
          type="button"
          onClick={() => {
            setMenuOpen(true);
            setShowSearch(true);
          }}
          className="inline-flex items-center gap-1.5 font-bold text-lg sm:text-xl md:text-2xl text-white tracking-tight drop-shadow-[0_2px_10px_rgba(0,0,0,0.7)] hover:opacity-85 transition-opacity cursor-pointer group"
        >
          <MapPin className="size-4 sm:size-5 text-sky-400 drop-shadow-[0_2px_4px_rgba(0,140,255,0.8)] transition-transform group-hover:scale-110" />
          <span>{active?.name ?? "Warszawa"}</span>
          <ChevronDown className="size-3 sm:size-4 text-white/65 group-hover:text-white transition-colors ml-0.5" />
        </button>

        <StepPlace
          direction="next"
          places={savedLocations}
          active={active}
          disabled={isPending}
          onSelect={handleSelectLocation}
        />
      </div>

      {/* RIGHT: Refresh Action Vector */}
      <div className="flex items-center gap-2">
        <Button
          variant="glass"
          size="icon-sm"
          aria-label="Odśwież prognozę"
          className="size-10 sm:size-11 rounded-full micro-press shadow-sm hover:rotate-12 hover:border-white/35 transition-all duration-[200ms]"
          onClick={() => refetch()}
          disabled={isFetching || isOfflineState}
        >
          <RefreshCw className={`size-4.5 sm:size-5 ${isFetching ? "animate-spin text-amber-400" : "text-white/90"}`} />
        </Button>
      </div>
    </header>
  );

  if (!data) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-[500px]">
        {topNav}
        <p className="text-sm font-medium text-white/70 animate-pulse">Ładowanie pogodowego obrazu...</p>
      </div>
    );
  }

  return (
    <HeroContent
      conditions={data}
      locale={locale}
      localHour={localHour}
      topNav={topNav}
      isUpdating={isFetching}
      isOffline={isOfflineState}
    />
  );
}

/**
 * One step through the saved places, in either direction.
 *
 * The last inequality between the two clients: mobile moves between places
 * with a swipe, while web made you open a menu and pick from a list. The menu
 * is still there and still holds the search - this covers the common case,
 * which is two or three places and a step between them.
 *
 * Renders nothing for fewer than two places, and wraps around at the ends
 * rather than disabling: a disabled arrow at the edge of a three-item list is
 * a control that spends most of its life dead.
 */
function StepPlace({
  direction,
  places,
  active,
  disabled,
  onSelect,
}: {
  direction: "previous" | "next";
  places: SavedLocation[];
  active?: ActiveLocation;
  disabled: boolean;
  onSelect: (location: ActiveLocation) => void;
}) {
  if (places.length < 2) return null;

  const current = places.findIndex((place) => place.id === active?.savedLocationId);
  const step = direction === "next" ? 1 : -1;
  // From -1 (a place that is not saved, e.g. one just searched for) a step
  // forward lands on the first saved place rather than nowhere.
  const target = places[(current + step + places.length) % places.length]!;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() =>
        onSelect({
          savedLocationId: target.id,
          name: target.name,
          latitude: target.latitude,
          longitude: target.longitude,
        })
      }
      aria-label={target.name}
      className="rounded-full p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-40"
    >
      {direction === "next" ? (
        <ChevronRight className="size-4 sm:size-5" />
      ) : (
        <ChevronLeft className="size-4 sm:size-5" />
      )}
    </button>
  );
}
