"use server";

import { createClient } from "@/lib/supabase/server";

export async function sendChatMessage(formData: FormData) {
  const supabase = await createClient();
  const text = String(formData.get("content") ?? "").trim().slice(0, 500);
  if (!text) return { ok: false, error: "empty" };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauth" };

  // RLS does the real check; this insert will fail for unapproved users.
  const { error } = await supabase
    .from("chat_messages")
    .insert({ content: text, user_id: user.id });

  if (error) return { ok: false, error: error.message };
  // Realtime delivers the new row to clients, so no revalidatePath needed.
  return { ok: true };
}
