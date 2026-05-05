"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLinks({
  isAdmin,
  pendingCount = 0,
}: {
  isAdmin: boolean;
  pendingCount?: number;
}) {
  const path = usePathname() ?? "";
  const active = (href: string) =>
    path === href || path.startsWith(href + "/");
  const baseCls = "px-2 py-1 rounded transition";
  const cls = (href: string, extra = "") =>
    baseCls +
    " " + extra + " " +
    (active(href)
      ? "bg-neutral-900 text-white"
      : "text-neutral-700 hover:bg-neutral-100");
  const adminCls = (href: string) =>
    baseCls +
    " " +
    (active(href)
      ? "bg-amber-600 text-white"
      : "text-amber-700 hover:bg-amber-50");

  return (
    <>
      <Link href="/schedule" className={cls("/schedule", "font-semibold")}>
        🏒 Tipovačka
      </Link>
      <Link href="/rules" className={cls("/rules")}>
        Pravidla
      </Link>
      <Link href="/hraci" className={cls("/hraci")}>
        Hráči
      </Link>
      {isAdmin && (
        <>
          <span className="mx-2 text-neutral-300">|</span>
          <Link href="/admin/matches" className={adminCls("/admin/matches")}>
            Zápasy & výsledky
          </Link>
          <Link href="/admin/history" className={adminCls("/admin/history")}>
            Historie tipů
          </Link>
          <Link
            href="/admin/pending"
            className={
              baseCls +
              " " +
              (active("/admin/pending")
                ? "bg-rose-600 text-white"
                : pendingCount > 0
                  ? "bg-rose-100 text-rose-800 ring-1 ring-rose-300 animate-pulse"
                  : "text-amber-700 hover:bg-amber-50")
            }
          >
            Pozdní tipy
            {pendingCount > 0 && (
              <span className="ml-1 inline-flex items-center justify-center rounded-full bg-rose-600 px-1.5 text-[10px] font-semibold text-white">
                {pendingCount}
              </span>
            )}
          </Link>
        </>
      )}
    </>
  );
}
