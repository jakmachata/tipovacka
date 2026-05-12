"use client";

import Link from "next/link";

interface Props {
  displayName: string;
  isAdmin?: boolean;
  pendingCount?: number;
  bold?: boolean;
}

export function AdminMenu({ displayName, bold = false }: Props) {
  return (
    <Link
      href="/profile"
      className={
        "hover:underline " +
        (bold ? "font-bold text-neutral-700" : "text-neutral-500")
      }
    >
      {displayName}
    </Link>
  );
}
