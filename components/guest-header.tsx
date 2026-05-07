"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Inline login + register pro nepřihlášené hosty.
 * Zobrazené v hlavičce schedule/trophies.
 */
export function GuestHeader() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const sb = createClient();
    if (mode === "login") {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) {
        setErr(error.message);
        setBusy(false);
        return;
      }
      // Po loginu refresh aby server-rendered layout přepnul z guest na member.
      window.location.reload();
    } else {
      const { error } = await sb.auth.signUp({ email, password });
      if (error) {
        setErr(error.message);
        setBusy(false);
        return;
      }
      // Po registraci profil čeká na schválení.
      window.location.href = "/pending";
    }
  }

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded bg-black px-3 py-1.5 text-white hover:bg-neutral-800"
      >
        Přihlásit / Registrace
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-72 rounded-lg border bg-white p-4 shadow-xl">
          <div className="mb-3 flex gap-1 text-xs">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={
                "flex-1 rounded px-2 py-1 " +
                (mode === "login"
                  ? "bg-neutral-900 text-white"
                  : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200")
              }
            >
              Přihlášení
            </button>
            <button
              type="button"
              onClick={() => setMode("register")}
              className={
                "flex-1 rounded px-2 py-1 " +
                (mode === "register"
                  ? "bg-neutral-900 text-white"
                  : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200")
              }
            >
              Registrace
            </button>
          </div>
          <form onSubmit={submit} className="space-y-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="email"
              className="w-full rounded border px-2 py-1.5 text-sm"
            />
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={mode === "register" ? 6 : undefined}
                placeholder={mode === "register" ? "heslo (min. 6 znaků)" : "heslo"}
                className="w-full rounded border px-2 py-1.5 pr-9 text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                title={showPw ? "Skrýt heslo" : "Zobrazit heslo"}
                aria-label={showPw ? "Skrýt heslo" : "Zobrazit heslo"}
                className="absolute inset-y-0 right-0 flex w-8 items-center justify-center text-neutral-500 hover:text-neutral-800"
              >
                {showPw ? "🙈" : "👁️"}
              </button>
            </div>
            {err && <p className="text-xs text-rose-600">{err}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
              {busy
                ? "Zpracovávám…"
                : mode === "login"
                  ? "Přihlásit"
                  : "Vytvořit účet"}
            </button>
          </form>
          {mode === "register" && (
            <p className="mt-2 text-[11px] text-neutral-500">
              Po registraci tě musí Master schválit a přidělit ti přezdívku.
            </p>
          )}
          {mode === "login" && (
            <p className="mt-2 text-[11px]">
              <span className="rounded bg-rose-100 px-1.5 py-0.5 text-rose-800">
                Zapomenuté heslo (zatím nefunkční - kontaktuj Mastera)
              </span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
