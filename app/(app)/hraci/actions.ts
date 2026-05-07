"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Binární status: schválen → tipuje, neschválen → nemůže tipovat (ale vidí schedule).
export type Status = "Neschválen" | "Tipující";

export async function setStatus(formData: FormData) {
  const sb = await createClient();
  const id = String(formData.get("id"));
  const next = String(formData.get("next")) as Status;
  // is_approved + is_player sjednoceny — buď oboje true, nebo oboje false.
  const fields =
    next === "Tipující"
      ? { is_approved: true, is_player: true }
      : { is_approved: false, is_player: false };
  await sb.from("profiles").update(fields).eq("id", id);
  revalidatePath("/hraci");
  revalidatePath("/schedule");
}
