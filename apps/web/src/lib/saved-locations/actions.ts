"use server";

import { revalidatePath } from "next/cache";

import { createSavedLocation, deleteSavedLocation, updateMinSeverity } from "./api";

export type SaveLocationActionState = { error?: string };

export async function saveLocationAction(
  _prevState: SaveLocationActionState,
  formData: FormData,
): Promise<SaveLocationActionState> {
  const name = String(formData.get("name") ?? "");
  const latitude = Number(formData.get("latitude"));
  const longitude = Number(formData.get("longitude"));

  const result = await createSavedLocation(name, latitude, longitude);
  if (!result.ok) {
    return { error: result.error };
  }

  revalidatePath("/locations");
  return {};
}

export async function deleteLocationAction(id: number): Promise<void> {
  await deleteSavedLocation(id);
  revalidatePath("/locations");
}

/**
 * Sets the lowest warning level worth notifying about at one place.
 *
 * Revalidates the home screen as well as the list. The threshold does not
 * change what the home screen *shows* - a warning below it still appears
 * (decision 25) - but the list is rendered there too, and leaving one page
 * showing a value the other has changed is the kind of small lie that makes
 * people stop trusting a setting.
 */
export async function updateMinSeverityAction(
  id: number,
  minSeverity: "1" | "2" | "3",
): Promise<void> {
  await updateMinSeverity(id, minSeverity);
  revalidatePath("/locations");
  revalidatePath("/");
}
