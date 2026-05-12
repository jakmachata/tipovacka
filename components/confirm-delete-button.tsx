"use client";
import { useState } from "react";
import { useFormStatus } from "react-dom";

export function ConfirmDeleteButton() {
  const { pending } = useFormStatus();
  const [armed, setArmed] = useState(false);

  if (armed) {
    return (
      <span className="inline-flex items-center gap-1">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          {pending ? "Mažu…" : "Smazat zápas?"}
        </button>
        <button
          type="button"
          onClick={() => setArmed(false)}
          className="rounded border px-2 py-1 text-xs hover:bg-neutral-50"
        >
          Zpět
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setArmed(true)}
      title="Smazat zápas"
      className="rounded border px-2 py-1 text-xs hover:bg-red-50 hover:border-red-300"
    >
      🗑
    </button>
  );
}
