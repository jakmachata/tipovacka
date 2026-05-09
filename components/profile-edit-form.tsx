"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Props {
  userId: string;
  userEmail: string;
  initial: {
    name: string;
    bg: string;
    text: string;
  };
}

export function ProfileEditForm({ userId, userEmail, initial }: Props) {
  const [name, setName] = useState(initial.name);
  const [bg, setBg] = useState(initial.bg);
  const [text, setText] = useState(initial.text);
  const [pwNew, setPwNew] = useState("");
  const [pwNew2, setPwNew2] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPw, setSavingPw] = useState(false);
  const [profileErr, setProfileErr] = useState("");
  const [profileMsg, setProfileMsg] = useState("");
  const [pwErr, setPwErr] = useState("");
  const [pwMsg, setPwMsg] = useState("");
  const router = useRouter();

  async function saveProfile() {
    setSavingProfile(true);
    setProfileErr("");
    setProfileMsg("");
    const sb = createClient();
    const trimmed = name.trim().slice(0, 12);
    if (!trimmed) {
      setProfileErr("Přezdívka nemůže být prázdná.");
      setSavingProfile(false);
      return;
    }
    const { error } = await sb
      .from("profiles")
      .update({
        display_name: trimmed,
        bg_color: bg,
        text_color: text,
      })
      .eq("id", userId);
    setSavingProfile(false);
    if (error) {
      setProfileErr(error.message);
    } else {
      setProfileMsg("Uloženo ✓");
      setTimeout(() => setProfileMsg(""), 3000);
      router.refresh();
    }
  }

  async function changePassword() {
    setSavingPw(true);
    setPwErr("");
    setPwMsg("");
    if (pwNew.length < 6) {
      setPwErr("Nové heslo musí mít aspoň 6 znaků.");
      setSavingPw(false);
      return;
    }
    if (pwNew !== pwNew2) {
      setPwErr("Hesla se neshodují.");
      setSavingPw(false);
      return;
    }
    const sb = createClient();
    const { error } = await sb.auth.updateUser({ password: pwNew });
    setSavingPw(false);
    if (error) {
      setPwErr(error.message);
    } else {
      setPwMsg("Heslo změněno ✓");
      setPwNew("");
      setPwNew2("");
      setTimeout(() => setPwMsg(""), 5000);
    }
  }

  return (
    <div className="max-w-md space-y-6">
      <section className="rounded-lg border p-4">
        <h2 className="mb-3 text-sm font-semibold text-neutral-700">
          Přezdívka & barvy
        </h2>
        <p className="mb-3 text-xs text-neutral-500">E-mail: {userEmail}</p>

        <label className="block text-sm">
          <span className="block text-xs text-neutral-500">
            Přezdívka (max 12 znaků)
          </span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={12}
            className="mt-1 w-full rounded border px-3 py-2 text-sm"
          />
        </label>

        <div
          className="my-4 rounded px-4 py-3 text-center text-sm font-semibold"
          style={{ backgroundColor: bg, color: text }}
        >
          {(name || "Náhled") + " (náhled)"}
        </div>

        <div className="flex gap-4">
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

        {profileErr && (
          <p className="mt-3 text-sm text-rose-600">{profileErr}</p>
        )}
        {profileMsg && (
          <p className="mt-3 text-sm font-semibold text-emerald-700">
            {profileMsg}
          </p>
        )}

        <button
          type="button"
          onClick={saveProfile}
          disabled={savingProfile}
          className="mt-3 rounded bg-black px-4 py-2 text-sm text-white hover:bg-neutral-800 disabled:opacity-50"
        >
          {savingProfile ? "Ukládám…" : "Uložit profil"}
        </button>
      </section>

      <section className="rounded-lg border p-4">
        <h2 className="mb-3 text-sm font-semibold text-neutral-700">
          Změna hesla
        </h2>
        <label className="block text-sm">
          <span className="block text-xs text-neutral-500">
            Nové heslo (min. 6 znaků)
          </span>
          <input
            type="password"
            value={pwNew}
            onChange={(e) => setPwNew(e.target.value)}
            className="mt-1 w-full rounded border px-3 py-2 text-sm"
          />
        </label>
        <label className="mt-3 block text-sm">
          <span className="block text-xs text-neutral-500">Heslo znovu</span>
          <input
            type="password"
            value={pwNew2}
            onChange={(e) => setPwNew2(e.target.value)}
            className="mt-1 w-full rounded border px-3 py-2 text-sm"
          />
        </label>
        {pwErr && <p className="mt-3 text-sm text-rose-600">{pwErr}</p>}
        {pwMsg && (
          <p className="mt-3 text-sm font-semibold text-emerald-700">{pwMsg}</p>
        )}
        <button
          type="button"
          onClick={changePassword}
          disabled={savingPw}
          className="mt-3 rounded bg-black px-4 py-2 text-sm text-white hover:bg-neutral-800 disabled:opacity-50"
        >
          {savingPw ? "Měním…" : "Změnit heslo"}
        </button>
      </section>
    </div>
  );
}
