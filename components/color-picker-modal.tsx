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

const PRESETS: Array<{ bg: string; text: string }> = [
  { bg: "#dc2626", text: "#ffffff" }, // rose
  { bg: "#ea580c", text: "#ffffff" }, // orange
  { bg: "#d97706", text: "#ffffff" }, // amber
  { bg: "#ca8a04", text: "#ffffff" }, // yellow
  { bg: "#65a30d", text: "#ffffff" }, // lime
  { bg: "#16a34a", text: "#ffffff" }, // green
  { bg: "#059669", text: "#ffffff" }, // emerald
  { bg: "#0d9488", text: "#ffffff" }, // teal
  { bg: "#0891b2", text: "#ffffff" }, // cyan
  { bg: "#0284c7", text: "#ffffff" }, // sky
  { bg: "#2563eb", text: "#ffffff" }, // blue
  { bg: "#4f46e5", text: "#ffffff" }, // indigo
  { bg: "#7c3aed", text: "#ffffff" }, // violet
  { bg: "#c026d3", text: "#ffffff" }, // fuchsia
  { bg: "#db2777", text: "#ffffff" }, // pink
  { bg: "#0a0a0a", text: "#ffffff" }, // black
  { bg: "#ffffff", text: "#0a0a0a" }, // white
  { bg: "#facc15", text: "#0a0a0a" }, // yellow-light
];

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

  async function reset() {
    setSaving(true);
    setErr("");
    const sb = createClient();
    const { error } = await sb
      .from("profiles")
      .update({ bg_color: null, text_color: null })
      .eq("id", userId);
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

        <div className="mb-4">
          <label className="mb-1 block text-xs uppercase tracking-wide text-neutral-500">
            Předvolby barev
          </label>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  setBg(p.bg);
                  setText(p.text);
                }}
                className="h-7 w-7 rounded border border-neutral-200 text-[10px] font-bold"
                style={{ backgroundColor: p.bg, color: p.text }}
                title={p.bg}
              >
                Aa
              </button>
            ))}
          </div>
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

        <div className="flex justify-between gap-2">
          <button
            type="button"
            onClick={reset}
            disabled={saving}
            className="rounded border border-neutral-300 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
          >
            Vrátit barvy na výchozí
          </button>
          <div className="flex gap-2">
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
    </div>
  );
}
