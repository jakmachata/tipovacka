"use server";

import { createClient } from "@/lib/supabase/server";

export async function sendChatMessage(formData: FormData) {
  const supabase = await createClient();
  const text = String(formData.get("content") ?? "").trim().slice(0, 500);
  if (!text) return { ok: false as const, error: "empty" };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "unauth" };

  const { data, error } = await supabase
    .from("chat_messages")
    .insert({ content: text, user_id: user.id })
    .select("id, user_id, content, created_at")
    .single();

  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, message: data };
}
