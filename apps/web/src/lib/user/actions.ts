"use server";

import { revalidatePath } from "next/cache";

import { updatePreferences, type UnitPreferences } from "./api";

export type PreferencesActionState = { error?: string; saved?: boolean };

const TEMPERATURE = ["CELSIUS", "FAHRENHEIT"] as const;
const WIND = ["KMH", "MPH"] as const;
const PRECIPITATION = ["MM", "IN"] as const;

/** Narrows a form value to the enum, so nothing unvalidated reaches the API. */
function pick<T extends readonly string[]>(
  value: FormDataEntryValue | null,
  allowed: T,
): T[number] | undefined {
  const candidate = String(value ?? "");
  return (allowed as readonly string[]).includes(candidate)
    ? (candidate as T[number])
    : undefined;
}

export async function savePreferencesAction(
  _prevState: PreferencesActionState,
  formData: FormData,
): Promise<PreferencesActionState> {
  // A Server Action is a POST endpoint - form values are validated here
  // regardless of what the client already checked.
  const preferences: UnitPreferences = {
    temperatureUnit: pick(formData.get("temperatureUnit"), TEMPERATURE),
    windSpeedUnit: pick(formData.get("windSpeedUnit"), WIND),
    precipitationUnit: pick(formData.get("precipitationUnit"), PRECIPITATION),
  };

  const ok = await updatePreferences(preferences);
  if (!ok) {
    return { error: "Nie udało się zapisać ustawień." };
  }

  revalidatePath("/settings");
  revalidatePath("/");
  return { saved: true };
}
