"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Inline login + register pro nepřihlášené hosty.
 * Zobrazené v hlavičce schedule/trophies.
 */

function EyeIcon({ open }: { open: boolean }) {
  // SVG eye / eye-off ikona (feather icons style)
  if (open) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 11 7 11 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 1 12s4 7 11 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  );
}

export function GuestHeader() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [registerSuccess, setRegisterSuccess] = useState(false);
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
      window.location.reload();
    } else {
      // Validace shody hesel pro registraci.
      if (password !== password2) {
        setErr("Hesla se neshodují.");
        setBusy(false);
        return;
      }
      const { data, error } = await sb.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin + "/pending",
        },
      });
      if (error) {
        setErr(error.message);
        setBusy(false);
        return;
      }
      // Supabase v2 vrací data.user.identities = [] když e-mail už existuje
      // (anti-enumeration default). Pro nás je to tichá smrt registrace,
      // takže to detekujeme a uživatele upozorníme.
      if (data?.user && (!data.user.identities || data.user.identities.length === 0)) {
        setErr(
          "Tento e-mail je už registrovaný.",
        );
        setBusy(false);
        return;
      }
      setRegisterSuccess(true);
      setBusy(false);
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
        <div className="absolute left-0 top-full z-50 mt-1 w-72 rounded-lg border bg-white p-4 shadow-xl md:left-auto md:right-0">
          {registerSuccess ? (
            <div className="space-y-3 text-sm">
              <h3 className="font-semibold">Skoro hotovo! ✅</h3>
              <p className="text-neutral-600">
                Poslali jsme ti potvrzovací e-mail na <strong>{email}</strong>.
                Klikni na odkaz v e-mailu pro ověření a pak počkej, až tě Kuba
                schválí.
              </p>
              <p className="text-xs text-neutral-500">
                Pokud e-mail nedorazil do pár minut, zkontroluj spam.
              </p>
              <button
                type="button"
                onClick={() => {
                  setRegisterSuccess(false);
                  setMode("login");
                  setEmail("");
                  setPassword("");
                  setPassword2("");
                }}
                className="w-full rounded bg-black px-3 py-1.5 text-sm text-white"
              >
                Zavřít
              </button>
            </div>
          ) : (
            <>
              <div className="mb-3 flex gap-1 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setErr("");
                  }}
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
                  onClick={() => {
                    setMode("register");
                    setErr("");
                  }}
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
                    <EyeIcon open={showPw} />
                  </button>
                </div>
                {mode === "register" && (
                  <input
                    type={showPw ? "text" : "password"}
                    value={password2}
                    onChange={(e) => setPassword2(e.target.value)}
                    required
                    minLength={6}
                    placeholder="heslo znovu"
                    className="w-full rounded border px-2 py-1.5 text-sm"
                  />
                )}
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
                  Po registraci ti přijde potvrzovací e-mail.
                </p>
              )}
              {mode === "login" && (
                <p className="mt-2 text-[11px]">
                  <span className="rounded bg-rose-100 px-1.5 py-0.5 text-rose-800">
                    Zapomenuté heslo (zatím nefunkční - kontaktuj Kubu)
                  </span>
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
