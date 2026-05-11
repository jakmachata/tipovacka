"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Per-user favourite tipsters. Called from TipMatrix toggleFavorite.
// Persists across devices (replaces localStorage-only storage).
export async function setMyFavorites(favorites: string[]) {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return;
  // Dedupe + cap to a reasonable size (defensive).
  const clean = Array.from(new Set(favorites)).slice(0, 100);
  await sb.from("profiles").update({ favorites: clean }).eq("id", user.id);
  revalidatePath("/");
}
