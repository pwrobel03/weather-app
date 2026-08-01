import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { AlertEntry } from "@/components/alert-entry";
import { fetchAlertHistory } from "@/lib/alerts/api";
import { isAuthenticated } from "@/lib/auth/session";
import { DEFAULT_LOCALE, type Locale } from "@weather-app/core";
import { fetchSavedLocations } from "@/lib/saved-locations/api";

export const dynamic = "force-dynamic";

const LABELS: Record<Locale, { title: string; empty: string; back: string; signIn: string }> = {
  pl: {
    title: "Oś czasu ostrzeżeń",
    empty: "Dla tego miejsca nie zapisano jeszcze żadnego ostrzeżenia.",
    back: "Wróć",
    signIn: "Zaloguj się, żeby zobaczyć oś czasu.",
  },
  en: {
    title: "Warning timeline",
    empty: "No warning has been recorded for this place yet.",
    back: "Back",
    signIn: "Sign in to see the timeline.",
  },
};

export default async function AlertTimelinePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const locale = DEFAULT_LOCALE;
  const labels = LABELS[locale];
  const { id } = await params;
  const locationId = Number(id);

  if (!Number.isInteger(locationId)) {
    notFound();
  }

  if (!(await isAuthenticated())) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-4 px-6 py-12 text-center">
        <h1 className="text-2xl font-semibold">{labels.title}</h1>
        <p className="text-sm text-muted-foreground">{labels.signIn}</p>
        <Link href="/login" className="text-sm text-primary underline-offset-4 hover:underline">
          {labels.signIn}
        </Link>
      </main>
    );
  }

  // Resolved from the user's own list rather than trusted from the URL, so the
  // heading cannot be made to display a name the caller does not own.
  const locations = await fetchSavedLocations();
  const location = locations.find((candidate) => candidate.id === locationId);
  if (!location) {
    notFound();
  }

  const alerts = await fetchAlertHistory(locationId);
  const now = new Date();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8 md:px-6">
      <div className="flex flex-col gap-1">
        <Link
          href="/locations"
          className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          {labels.back}
        </Link>
        <h1 className="text-2xl font-semibold">{labels.title}</h1>
        <p className="text-sm text-muted-foreground">{location.name}</p>
      </div>

      {alerts.length === 0 ? (
        <p className="text-sm text-muted-foreground">{labels.empty}</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {alerts.map((alert) => (
            <li key={alert.id}>
              <Link href={`/alerts/${alert.id}`} className="block">
                <AlertEntry alert={alert} locale={locale} now={now} />
              </Link>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
