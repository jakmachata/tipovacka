"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type Status = "Neschválen" | "Netipující" | "Tipující";

export async function setStatus(formData: FormData) {
  const sb = await createClient();
  const id = String(formData.get("id"));
  const next = String(formData.get("next")) as Status;
  const fields =
    next === "Neschválen"
      ? { is_approved: false, is_player: false }
      : next === "Netipující"
        ? { is_approved: true, is_player: false }
        : { is_approved: true, is_player: true };
  await sb.from("profiles").update(fields).eq("id", id);
  revalidatePath("/hraci");
  revalidatePath("/schedule");
}
