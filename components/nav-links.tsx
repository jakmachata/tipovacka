"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLinks({ isAdmin }: { isAdmin: boolean }) {
  const path = usePathname() ?? "";
  const active = (href: string) =>
    path === href || path.startsWith(href + "/");
  const baseCls =
    "px-2 py-1 rounded transition";
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
      {isAdmin && (
        <>
          <span className="mx-2 text-neutral-300">|</span>
          <Link href="/admin/users" className={adminCls("/admin/users")}>
            Hráči
          </Link>
          <Link href="/admin/matches" className={adminCls("/admin/matches")}>
            Zápasy & výsledky
          </Link>
        </>
      )}
    </>
  );
}
