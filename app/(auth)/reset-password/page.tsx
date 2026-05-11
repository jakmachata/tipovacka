"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Reset password landing page.
 *
 * Uživatel sem doplave po kliknutí na odkaz v e-mailu z resetPasswordForEmail.
 * Supabase v URL hashi posílá access_token + type=recovery; @supabase/ssr klient
 * to při mountu zachytí přes detectSessionInUrl a vytvoří dočasnou session
 * s rolí "authenticated" pouze na update password.
 *
 * Pokud uživatel přijde sem bez recovery sessionu (otevřel odkaz po expiraci,
 * nebo přímo /reset-password), ukážeme mu hlášku ať si vyžádá nový reset.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [hasRecovery, setHasRecovery] = useState(false);
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    const sb = createClient();
    // Supabase auto-zachytí token z URL hashe (detectSessionInUrl: true default).
    // PASSWORD_RECOVERY event nám potvrdí že máme recovery session.
    const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setHasRecovery(true);
        setReady(true);
      }
    });
    // Fallback: po 500ms zkontroluj zda máme aktivní session — když ano, povolíme reset.
    const t = setTimeout(async () => {
      const { data } = await sb.auth.getSession();
      if (data.session) {
        setHasRecovery(true);
      }
      setReady(true);
    }, 500);
    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(t);
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (password.length < 6) {
      setErr("Heslo musí mít minimálně 6 znaků.");
      return;
    }
    if (password !== password2) {
      setErr("Hesla se neshodují.");
      return;
    }
    setBusy(true);
    const sb = createClient();
    const { error } = await sb.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setDone(true);
    // Po 2 sekundách přesměrovat na hlavní stránku.
    setTimeout(() => {
      router.push("/");
    }, 2000);
  }

  return (
    <div className="mx-auto mt-12 max-w-sm rounded-lg border bg-white p-6 shadow-sm">
      <h1 className="mb-3 text-lg font-semibold">Nastavit nové heslo</h1>

      {!ready ? (
        <p className="text-sm text-neutral-500">Načítám…</p>
      ) : done ? (
        <div className="space-y-2 text-sm">
          <p className="font-semibold text-emerald-700">Heslo změněno ✓</p>
          <p className="text-neutral-600">
            Za chvíli tě přesměruji na hlavní stránku.
          </p>
        </div>
      ) : !hasRecovery ? (
        <div className="space-y-3 text-sm">
          <p className="text-rose-700">
            Tento odkaz buď vypršel, nebo byl už použit.
          </p>
          <p className="text-neutral-600">
            Vrať se na hlavní stránku a vyžádej si nový reset link
            přes "Přihlásit" → "Zapomenuté heslo".
          </p>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="w-full rounded bg-black px-3 py-1.5 text-sm text-white"
          >
            Na hlavní stránku
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3 text-sm">
          <label className="block">
            <span className="mb-1 block text-xs text-neutral-600">Nové heslo</span>
            <input
              type={showPw ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder="alespoň 6 znaků"
              className="w-full rounded border px-2 py-1.5 text-base"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-neutral-600">Nové heslo znovu</span>
            <input
              type={showPw ? "text" : "password"}
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              required
              minLength={6}
              className="w-full rounded border px-2 py-1.5 text-base"
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-neutral-600">
            <input
              type="checkbox"
              checked={showPw}
              onChange={(e) => setShowPw(e.target.checked)}
            />
            Zobrazit hesla
          </label>
          {err && <p className="text-xs text-rose-600">{err}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
          >
            {busy ? "Ukládám…" : "Uložit nové heslo"}
          </button>
        </form>
      )}
    </div>
  );
}
