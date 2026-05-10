"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AdminMenu } from "./admin-menu";

interface Props {
  displayName: string;
  isAdmin: boolean;
  pendingCount: number;
  logoutAction: () => void | Promise<void>;
}

export function UserBar({ displayName, isAdmin, pendingCount, logoutAction }: Props) {
  const path = usePathname() ?? "";
  const onProfile = path === "/profile" || path.startsWith("/profile/");

  return (
    <>
      <AdminMenu
        displayName={displayName}
        isAdmin={isAdmin}
        pendingCount={pendingCount}
        bold={!onProfile}
      />
      <Link
        href="/profile"
        className={
          "hover:underline " +
          (onProfile ? "font-bold text-neutral-700" : "text-neutral-500")
        }
      >
        Nastavení
      </Link>
      <form action={logoutAction}>
        <button className="text-neutral-500 hover:underline">Odhlásit</button>
      </form>
    </>
  );
}
