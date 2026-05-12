"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

/**
 * Submit button pro admin/matches form.
 * Po dokončení server action zobrazí "Uloženo ✓" na 2s.
 * Uses useFormStatus z react-dom (musí být uvnitř <form action={serverAction}>).
 */
export function SaveMatchButton() {
  const { pending } = useFormStatus();
  const [showSaved, setShowSaved] = useState(false);
  const [wasPending, setWasPending] = useState(false);

  useEffect(() => {
    if (wasPending && !pending) {
      setShowSaved(true);
      const t = setTimeout(() => setShowSaved(false), 2000);
      return () => clearTimeout(t);
    }
    setWasPending(pending);
  }, [pending, wasPending]);

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
      >
        {pending ? "Ukládám…" : "Uložit"}
      </button>
      {showSaved && (
        <span className="text-sm font-medium text-emerald-700">Uloženo ✓</span>
      )}
    </span>
  );
}
