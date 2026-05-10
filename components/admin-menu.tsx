"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface Props {
  displayName: string;
  isAdmin: boolean;
  pendingCount?: number;
  bold?: boolean;
}

export function AdminMenu({ displayName, isAdmin, pendingCount = 0, bold = true }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const path = usePathname() ?? "";

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

  if (!isAdmin) {
    return <span className={(bold ? "font-bold " : "") + "text-neutral-700"}>{displayName}</span>;
  }
  // Admin barevné odlišení: alert (rose) když má čekající Pozdní tipy, jinak admin amber.
  // bold flag řídí font-weight (false když je uživatel na /profile a Nastavení je active).
  const nameClass =
    (bold ? "font-bold " : "") +
    (pendingCount > 0
      ? "text-rose-600 hover:underline animate-pulse"
      : "text-amber-700 hover:underline");

  const isActive = (href: string) => path === href || path.startsWith(href + "/");
  const linkBase = "block px-3 py-1.5 text-sm hover:bg-amber-50";
  const linkActive = "font-semibold text-amber-700 underline";
  const linkIdle = "text-amber-700";

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={nameClass}
        title="Admin menu"
      >
        {displayName}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-[180px] rounded border bg-white py-1 shadow-lg md:left-auto md:right-0">
          <Link
            href="/admin/matches"
            onClick={() => setOpen(false)}
            className={linkBase + " " + (isActive("/admin/matches") ? linkActive : linkIdle)}
          >
            Zápasy & výsledky
          </Link>
          <Link
            href="/admin/history"
            onClick={() => setOpen(false)}
            className={linkBase + " " + (isActive("/admin/history") ? linkActive : linkIdle)}
          >
            Historie tipů
          </Link>
          <Link
            href="/admin/trophies"
            onClick={() => setOpen(false)}
            className={linkBase + " " + (isActive("/admin/trophies") ? linkActive : linkIdle)}
          >
            Trophy edit
          </Link>
          <Link
            href="/admin/pending"
            onClick={() => setOpen(false)}
            className={
              "flex items-center justify-between gap-2 px-3 py-1.5 text-sm hover:bg-amber-50 " +
              (isActive("/admin/pending")
                ? "font-semibold text-rose-700 underline"
                : pendingCount > 0
                  ? "bg-rose-50 text-rose-700"
                  : "text-amber-700")
            }
          >
            <span>Pozdní tipy</span>
            {pendingCount > 0 && (
              <span className="inline-flex items-center justify-center rounded-full bg-rose-600 px-1.5 text-[10px] font-semibold text-white">
                {pendingCount}
              </span>
            )}
          </Link>
        </div>
      )}
    </div>
  );
}
