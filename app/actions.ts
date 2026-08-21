"use server";

import { revalidatePath } from "next/cache";
import { getLab } from "@/lib/lab";
import { getStore } from "@/lib/store";
import { syncContent } from "@/lib/content";

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

function refresh(): void {
  revalidatePath("/");
  revalidatePath("/library");
  revalidatePath("/setup");
}

export async function rollAction(): Promise<{ error?: string }> {
  try {
    getLab().roll();
    refresh();
    return {};
  } catch (error) {
    return { error: message(error) };
  }
}

export async function chooseAction(id: string): Promise<{ error?: string }> {
  try {
    getLab().choose(id);
    refresh();
    return {};
  } catch (error) {
    return { error: message(error) };
  }
}

export async function completeAction(formData: FormData): Promise<{ error?: string }> {
  try {
    const id = String(formData.get("id") ?? "");
    const notes = String(formData.get("notes") ?? "");
    let videoUrl = String(formData.get("videoUrl") ?? "").trim();
    const file = formData.get("file");
    if (file instanceof File && file.size > 0) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const stored = getStore().saveFile(file.name, bytes);
      videoUrl = `/api/media/${stored}`;
    }
    getLab().complete(id, { notes, videoUrl: videoUrl || undefined });
    refresh();
    return {};
  } catch (error) {
    return { error: message(error) };
  }
}

export async function syncAction(): Promise<{ error?: string; added?: number; skipped?: number }> {
  try {
    const result = syncContent(getStore());
    refresh();
    return { added: result.added, skipped: result.skipped };
  } catch (error) {
    return { error: message(error) };
  }
}

export async function deleteAvailableAction(id: string): Promise<{ error?: string }> {
  try {
    getLab().deleteAvailable(id);
    refresh();
    return {};
  } catch (error) {
    return { error: message(error) };
  }
}

export async function setTimezoneAction(timezone: string): Promise<void> {
  if (!timezone) return;
  const store = getStore();
  if (store.status().timezone === timezone) return;
  store.setTimezone(timezone);
}

export async function setSyllabusAction(id: string): Promise<{ error?: string }> {
  try {
    getLab().setActiveSyllabus(id);
    refresh();
    return {};
  } catch (error) {
    return { error: message(error) };
  }
}
