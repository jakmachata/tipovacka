"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLinks({
  isAdmin,
  pendingCount = 0,
  unapprovedCount = 0,
  guest = false,
}: {
  isAdmin: boolean;
  pendingCount?: number;
  unapprovedCount?: number;
  guest?: boolean;
}) {
  const path = usePathname() ?? "";
  const active = (href: string) =>
    path === href || path.startsWith(href + "/");
  // py-2 + border-y-2 transparent → menu vyšší, layout se nemění při aktivaci.
  // Aktivní stav přebarví obě 2px linky (přes font-bold + border-current).
  // Mobile o stupeň menší (15 px), desktop 17 px.
  const baseCls =
    "px-2 py-2 rounded transition text-[15px] md:text-[17px] border-y-2 border-transparent";
  // !border-current forsuje barvu nad baseCls .border-transparent (Tailwind class source order).
  const activeMark = "font-bold !border-current";
  const cls = (href: string, extra = "") =>
    baseCls +
    " " + extra + " " +
    (active(href)
      ? "text-neutral-900 " + activeMark
      : "text-neutral-700 hover:bg-neutral-100");
  const adminCls = (href: string) =>
    baseCls +
    " " +
    (active(href)
      ? "text-amber-700 " + activeMark
      : "text-amber-700 hover:bg-amber-50");

  // Hráči link: pokud je admin a má neschválené účty, svítí růžovou + pulse + badge.
  const hraciCls = (() => {
    if (isAdmin && unapprovedCount > 0) {
      return baseCls + " " +
        (active("/hraci")
          ? "bg-rose-100 text-rose-800 ring-1 ring-rose-300 " + activeMark
          : "bg-rose-100 text-rose-800 ring-1 ring-rose-300 animate-pulse");
    }
    return adminCls("/hraci");
  })();

  // Host: jen Natipovals + Trophy room (Pravidla a Hráči jen pro přihlášené).
  if (guest) {
    return (
      <>
        <Link href="/" className={cls("/", "font-semibold")}>
          🏒 Natipovals?
        </Link>
        <Link href="/trophies" className={cls("/trophies")}>
          Trophy room
        </Link>
      </>
    );
  }

  // Pořadí pro přihlášené: Natipovals → Pravidla → Trophy room. Hráči jen admin.
  return (
    <>
      <Link href="/" className={cls("/", "font-semibold")}>
        🏒 Natipovals?
      </Link>
      <Link href="/rules" className={cls("/rules")}>
        Pravidla
      </Link>
      <Link href="/trophies" className={cls("/trophies")}>
        Trophy room
      </Link>
      {isAdmin && (
        <>
          <span className="mx-2 text-neutral-300">|</span>
          <Link href="/hraci" className={hraciCls}>
            Hráči
            {unapprovedCount > 0 && (
              <span className="ml-1 inline-flex items-center justify-center rounded-full bg-rose-600 px-1.5 text-[10px] font-semibold text-white">
                {unapprovedCount}
              </span>
            )}
          </Link>
          <Link href="/admin/matches" className={adminCls("/admin/matches")}>
            Zápasy & výsledky
          </Link>
          <Link href="/admin/history" className={adminCls("/admin/history")}>
            Historie tipů
          </Link>
          <Link href="/admin/trophies" className={adminCls("/admin/trophies")}>
            Trophy edit
          </Link>
          <Link
            href="/admin/pending"
            className={
              baseCls +
              " " +
              (active("/admin/pending")
                ? "text-rose-700 " + activeMark
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
