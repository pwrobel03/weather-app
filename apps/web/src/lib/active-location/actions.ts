"use server";

import { revalidatePath } from "next/cache";

import { setActiveLocation, type ActiveLocation } from "./cookie";

export async function setActiveLocationAction(location: ActiveLocation): Promise<void> {
  await setActiveLocation(location);
  revalidatePath("/");
}
