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
    .select("id, user_id, content, created_at, edited_at")
    .single();

  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, message: data };
}

export async function deleteChatMessage(id: number) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "unauth" };

  // RLS enforces (autor do 10 min) NEBO admin
  const { error } = await supabase.from("chat_messages").delete().eq("id", id);
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

export async function editChatMessage(id: number, content: string) {
  const supabase = await createClient();
  const text = content.trim().slice(0, 500);
  if (!text) return { ok: false as const, error: "empty" };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "unauth" };

  // RLS enforces autor do 10 min od vytvoreni
  const { data, error } = await supabase
    .from("chat_messages")
    .update({ content: text, edited_at: new Date().toISOString() })
    .eq("id", id)
    .select("id, user_id, content, created_at, edited_at")
    .single();

  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, message: data };
}
