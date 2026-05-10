"use server";

import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";

const DUMMY_EMAIL_SUFFIX = "@tipovacka.local";

type SaveResult = { ok: true } | { error: string };

export async function saveProfileAction(input: {
  name: string;
  bg: string;
  text: string;
}): Promise<SaveResult> {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { error: "Nepřihlášený uživatel." };

  const trimmed = input.name.trim().slice(0, 12);
  if (!trimmed) return { error: "Přezdívka nemůže být prázdná." };

  // První pokus o update.
  const first = await sb
    .from("profiles")
    .update({
      display_name: trimmed,
      bg_color: input.bg,
      text_color: input.text,
    })
    .eq("id", user.id);

  if (!first.error) {
    revalidatePath("/schedule");
    return { ok: true };
  }

  const err = first.error;
  const isDuplicate =
    err.code === "23505" ||
    (err.message ?? "").toLowerCase().includes("duplicate");

  if (!isDuplicate) {
    return { error: err.message };
  }

  // Najít kdo má danou přezdívku
  const { data: existing } = await sb
    .from("profiles")
    .select("id, email, is_admin")
    .eq("display_name", trimmed)
    .maybeSingle();

  if (!existing) {
    return { error: "Přezdívka je obsazená." };
  }

  if (existing.id === user.id) {
    // Už ji vlastníš — možná case mismatch nebo nějaký glitch.
    return { error: "Tuto přezdívku už máš nastavenou." };
  }

  const isDummy =
    typeof existing.email === "string" &&
    existing.email.toLowerCase().endsWith(DUMMY_EMAIL_SUFFIX);

  if (!isDummy || existing.is_admin) {
    return { error: "Tuto přezdívku už používá jiný hráč. Zvol prosím jinou." };
  }

  // Dummy účet — uvolnit jméno, posunout do Neschválených.
  const admin = createServiceClient();
  // Vygeneruj náhradní jméno: prefix emailu seříznutý na 12, nebo "dummy_xxxxx".
  const emailPrefix = (existing.email ?? "").split("@")[0].slice(0, 12);
  const fallback = `dummy_${Math.random().toString(36).slice(2, 7)}`;
  const dummyNewName = emailPrefix || fallback;

  // Pokus o uvolnění s emailovým prefixem
  let renameErr: { message: string } | null = null;
  {
    const r = await admin
      .from("profiles")
      .update({
        display_name: dummyNewName,
        is_approved: false,
        is_player: false,
      })
      .eq("id", existing.id);
    renameErr = r.error;
  }
  // Když by emailový prefix také kolidoval, zkus fallback s náhodným suffixem.
  if (renameErr) {
    const r2 = await admin
      .from("profiles")
      .update({
        display_name: fallback,
        is_approved: false,
        is_player: false,
      })
      .eq("id", existing.id);
    renameErr = r2.error;
  }
  if (renameErr) {
    return {
      error: "Nepodařilo se uvolnit přezdívku z dummy účtu: " + renameErr.message,
    };
  }

  // Druhý pokus — teď by mělo projít.
  const second = await sb
    .from("profiles")
    .update({
      display_name: trimmed,
      bg_color: input.bg,
      text_color: input.text,
    })
    .eq("id", user.id);
  if (second.error) {
    return { error: second.error.message };
  }

  revalidatePath("/schedule");
  revalidatePath("/hraci");
  return { ok: true };
}
