"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

interface Props {
  field: string;
  label: string;
  title?: string;
}

export function SortableTh({ field, label, title }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const pathname = usePathname();
  const currentField = sp.get("sortBy");
  const currentOrder = sp.get("order");
  const isActive = currentField === field;
  const nextOrder = isActive && currentOrder === "asc" ? "desc" : "asc";

  const onClick = () => {
    const newSp = new URLSearchParams(sp.toString());
    newSp.set("sortBy", field);
    newSp.set("order", nextOrder);
    router.push(`${pathname}?${newSp.toString()}`);
  };

  return (
    <th
      className={
        "cursor-pointer select-none py-2 pr-3 text-right text-xs font-medium hover:text-neutral-900 " +
        (isActive ? "text-neutral-900" : "text-neutral-500")
      }
      title={title}
      onClick={onClick}
    >
      {label}
      {isActive && (
        <span className="ml-0.5">{currentOrder === "asc" ? "↑" : "↓"}</span>
      )}
    </th>
  );
}
