"use server";

import { revalidatePath } from "next/cache";

import { createSavedLocation, deleteSavedLocation } from "./api";

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
