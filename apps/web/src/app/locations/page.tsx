import Link from "next/link";

import { SavedLocationsManager } from "@/components/saved-locations-manager";
import { isAuthenticated } from "@/lib/auth/session";
import { fetchSavedLocations } from "@/lib/saved-locations/api";

export const dynamic = "force-dynamic";

export default async function LocationsPage() {
  const authenticated = await isAuthenticated();

  if (!authenticated) {
    return (
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4 px-6 py-12 text-center">
        <h1 className="text-2xl font-semibold">Lokalizacje</h1>
        <p className="text-sm text-muted-foreground">
          Zaloguj się, żeby zapisywać swoje lokalizacje.
        </p>
        <Link href="/login" className="text-sm text-primary underline-offset-4 hover:underline">
          Zaloguj się
        </Link>
      </div>
    );
  }

  const locations = await fetchSavedLocations();

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-6 py-12">
      <h1 className="text-2xl font-semibold">Lokalizacje</h1>
      <SavedLocationsManager locations={locations} />
    </div>
  );
}
