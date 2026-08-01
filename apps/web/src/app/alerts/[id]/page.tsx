import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getRequestLocale } from "@/lib/locale";

import { AlertEntry } from "@/components/alert-entry";
import { findAlertById } from "@/lib/alerts/api";
import { isAuthenticated } from "@/lib/auth/session";
import { DEFAULT_LOCALE, type Locale } from "@weather-app/core";

export const dynamic = "force-dynamic";

const LABELS: Record<Locale, { title: string; back: string; signIn: string; disclaimer: string }> = {
  pl: {
    title: "Ostrzeżenie",
    back: "Wróć",
    signIn: "Zaloguj się, żeby zobaczyć ostrzeżenie.",
    disclaimer:
      "Treść pochodzi bezpośrednio z IMGW i nie jest przez nas modyfikowana ani tłumaczona.",
  },
  en: {
    title: "Warning",
    back: "Back",
    signIn: "Sign in to see the warning.",
    disclaimer:
      "The text comes directly from IMGW and is neither edited nor translated by us.",
  },
};

export default async function AlertDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const locale = await getRequestLocale();
  const labels = LABELS[locale];
  const { id } = await params;
  const alertId = Number(id);

  if (!Number.isInteger(alertId)) {
    notFound();
  }

  if (!(await isAuthenticated())) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-4 px-6 py-12 text-center">
        <h1 className="text-2xl font-semibold">{labels.title}</h1>
        <Link href="/login" className="text-sm text-primary underline-offset-4 hover:underline">
          {labels.signIn}
        </Link>
      </main>
    );
  }

  // Resolved only from warnings that concern this account, so an id belonging
  // to someone else's location is indistinguishable from one that never
  // existed.
  const alert = await findAlertById(alertId);
  if (!alert) {
    notFound();
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8 md:px-6">
      <Link
        href="/"
        className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:underline"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {labels.back}
      </Link>

      <AlertEntry alert={alert} locale={locale} now={new Date()} detailed />

      <p className="text-xs text-muted-foreground">{labels.disclaimer}</p>
    </main>
  );
}
