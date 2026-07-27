import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { PreferencesForm } from "@/components/preferences-form";
import { logoutAction } from "@/lib/auth/actions";
import { fetchProfile } from "@/lib/user/api";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const profile = await fetchProfile();

  if (!profile) {
    return (
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4 px-6 py-12 text-center">
        <h1 className="text-2xl font-semibold">Ustawienia</h1>
        <p className="text-sm text-muted-foreground">Zaloguj się, żeby zmienić ustawienia.</p>
        <Link href="/login" className="text-sm text-primary underline-offset-4 hover:underline">
          Zaloguj się
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8 md:px-6">
      <div className="flex flex-col gap-1">
        <Link
          href="/"
          className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Wróć
        </Link>
        <h1 className="text-2xl font-semibold">Ustawienia</h1>
        <p className="text-sm text-muted-foreground">{profile.email}</p>
      </div>

      <PreferencesForm profile={profile} />

      <form action={logoutAction} className="border-t border-border pt-6">
        <button
          type="submit"
          className="text-sm text-destructive underline-offset-4 hover:underline"
        >
          Wyloguj się
        </button>
      </form>
    </main>
  );
}
