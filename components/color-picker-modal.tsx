"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface Props {
  userId: string;
  displayName: string;
  initialBg: string | null;
  initialText: string | null;
  // canEditName: může upravit přezdívku (vlastník nebo admin).
  canEditName?: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function ColorPickerModal({
  userId,
  displayName,
  initialBg,
  initialText,
  canEditName = false,
  onClose,
  onSaved,
}: Props) {
  const [name, setName] = useState(displayName);
  const [bg, setBg] = useState(initialBg ?? "#dc2626");
  const [text, setText] = useState(initialText ?? "#ffffff");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    setSaving(true);
    setErr("");
    const sb = createClient();
    const update: Record<string, unknown> = { bg_color: bg, text_color: text };
    if (canEditName) {
      const trimmed = name.trim().slice(0, 12);
      if (!trimmed) {
        setErr("Přezdívka nemůže být prázdná.");
        setSaving(false);
        return;
      }
      update.display_name = trimmed;
    }
    const { error } = await sb.from("profiles").update(update).eq("id", userId);
    setSaving(false);
    if (error) setErr(error.message);
    else onSaved();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-semibold">Profil</h2>

        {canEditName && (
          <div className="mb-4">
            <label className="mb-1 block text-xs uppercase tracking-wide text-neutral-500">
              Přezdívka (max. 12 znaků)
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={12}
              className="w-full rounded border px-3 py-2 text-sm"
            />
          </div>
        )}

        <div
          className="mb-4 rounded px-4 py-3 text-center text-sm font-semibold"
          style={{ backgroundColor: bg, color: text }}
        >
          {(name || displayName) + " (náhled)"}
        </div>

        <div className="mb-4 flex gap-4">
          <label className="flex-1 text-xs">
            <span className="block text-neutral-500">Pozadí</span>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="color"
                value={bg}
                onChange={(e) => setBg(e.target.value)}
                className="h-9 w-12 rounded border"
              />
              <input
                type="text"
                value={bg}
                onChange={(e) => setBg(e.target.value)}
                className="flex-1 rounded border px-2 py-1 font-mono"
                placeholder="#rrggbb"
              />
            </div>
          </label>
          <label className="flex-1 text-xs">
            <span className="block text-neutral-500">Text</span>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="color"
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="h-9 w-12 rounded border"
              />
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="flex-1 rounded border px-2 py-1 font-mono"
                placeholder="#rrggbb"
              />
            </div>
          </label>
        </div>

        {err && <p className="mb-3 text-sm text-rose-600">{err}</p>}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border px-4 py-2 text-sm hover:bg-neutral-50"
          >
            Zrušit
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {saving ? "Ukládám…" : "Uložit"}
          </button>
        </div>
      </div>
    </div>
  );
}
