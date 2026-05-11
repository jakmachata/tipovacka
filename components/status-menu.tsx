"use client";

import { useEffect, useRef, useState } from "react";

// Po veřejném schedule je status binární. Mezistav „Netipující" zmizel.
export type Status = "Nevyřízený" | "Neschválen" | "Tipující" | "Admin";

const ORDER: Status[] = ["Nevyřízený", "Neschválen", "Tipující", "Admin"];

const STATUS_CLS: Record<Status, string> = {
  Nevyřízený: "bg-neutral-300 text-neutral-700",
  Neschválen: "bg-neutral-100 text-neutral-600",
  Tipující: "bg-emerald-100 text-emerald-800",
  Admin: "bg-amber-100 text-amber-800",
};

const STATUS_EMOJI: Record<Status, string> = {
  Nevyřízený: "⏳",
  Neschválen: "❌",
  Tipující: "✅",
  Admin: "👑",
};

export function StatusMenu({
  id,
  current,
  action,
}: {
  id: string;
  current: Status;
  action: (fd: FormData) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
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

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={"cursor-pointer rounded px-2 py-1 " + STATUS_CLS[current]}
      >
        {current}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-10 mt-1 rounded border bg-white shadow-lg">
          {ORDER.map((opt) => (
            <form action={action} key={opt} className="block">
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="next" value={opt} />
              <button
                className={
                  "flex w-full items-center gap-2 whitespace-nowrap px-3 py-1.5 text-left text-sm hover:bg-neutral-100" +
                  (opt === current ? " font-semibold" : "")
                }
              >
                <span>{STATUS_EMOJI[opt]}</span>
                <span>{opt}</span>
              </button>
            </form>
          ))}
        </div>
      )}
    </div>
  );
}
