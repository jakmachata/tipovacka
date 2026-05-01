"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLinks({ isAdmin }: { isAdmin: boolean }) {
  const path = usePathname() ?? "";
  const active = (href: string) =>
    path === href || path.startsWith(href + "/");
  const cls = (href: string, base: string) =>
    base +
    " px-2 py-1 rounded transition " +
    (active(href)
      ? "bg-neutral-900 text-white"
      : "text-neutral-700 hover:bg-neutral-100");

  return (
    <>
      <Link href="/schedule" className={cls("/schedule", "font-semibold")}>
        🏒 Tipovačka
      </Link>
      <Link href="/rules" className={cls("/rules", "")}>
        Pravidla
      </Link>
      {isAdmin && (
        <Link
          href="/admin"
          className={
            "px-2 py-1 rounded transition " +
            (active("/admin")
              ? "bg-amber-600 text-white"
              : "text-amber-700 hover:bg-amber-50")
          }
        >
          Admin
        </Link>
      )}
    </>
  );
}
