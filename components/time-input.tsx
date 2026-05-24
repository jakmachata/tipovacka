"use client";

import { useState } from "react";

export function TimeInput({
  name,
  defaultValue,
  className,
  placeholder = "HH:MM",
}: {
  name: string;
  defaultValue?: string;
  className?: string;
  placeholder?: string;
}) {
  const [val, setVal] = useState(defaultValue ?? "");

  function format(raw: string): string {
    const digits = raw.replace(/\D/g, "").slice(0, 4);
    if (digits.length <= 2) return digits;
    return digits.slice(0, 2) + ":" + digits.slice(2);
  }

  return (
    <input
      type="text"
      name={name}
      value={val}
      onChange={(e) => setVal(format(e.target.value))}
      inputMode="numeric"
      maxLength={5}
      placeholder={placeholder}
      className={className ?? "w-[72px] rounded border px-2 py-1 text-sm"}
    />
  );
}
