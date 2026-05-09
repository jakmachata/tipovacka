"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Stavový diagram: Neschválen ↔ Tipující ↔ Admin. Admin má is_admin=true,
// is_approved=true, is_player=false (admin není tipující). Tipující is_player=true.
export type Status = "Neschválen" | "Tipující" | "Admin";

export async function setStatus(formData: FormData) {
  const sb = await createClient();
  const id = String(formData.get("id"));
  const next = String(formData.get("next")) as Status;
  const fields =
    next === "Admin"
      ? { is_admin: true, is_approved: true, is_player: false }
      : next === "Tipující"
        ? { is_admin: false, is_approved: true, is_player: true }
        : { is_admin: false, is_approved: false, is_player: false };
  await sb.from("profiles").update(fields).eq("id", id);
  revalidatePath("/hraci");
  revalidatePath("/");
  revalidatePath("/schedule");
}
