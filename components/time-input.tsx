"use client";

import { useState, useRef, type ChangeEvent, type KeyboardEvent } from "react";

export function TimeInput({
  name,
  defaultValue,
  className,
}: {
  name: string;
  defaultValue?: string;
  className?: string;
}) {
  const init = (defaultValue ?? "").split(":");
  const [hh, setHh] = useState((init[0] ?? "").replace(/\D/g, "").slice(0, 2));
  const [mm, setMm] = useState((init[1] ?? "").replace(/\D/g, "").slice(0, 2));
  const hhRef = useRef<HTMLInputElement>(null);
  const mmRef = useRef<HTMLInputElement>(null);

  function onHhChange(e: ChangeEvent<HTMLInputElement>) {
    const v = e.target.value.replace(/\D/g, "").slice(0, 2);
    setHh(v);
    if (v.length === 2) mmRef.current?.focus();
  }
  function onMmChange(e: ChangeEvent<HTMLInputElement>) {
    setMm(e.target.value.replace(/\D/g, "").slice(0, 2));
  }
  function onMmKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && mm === "") hhRef.current?.focus();
  }

  return (
    <span
      className={`inline-flex items-center ${
        className ?? "rounded border bg-white px-1.5 py-1 text-sm"
      }`}
    >
      <input
        ref={hhRef}
        type="text"
        value={hh}
        onChange={onHhChange}
        inputMode="numeric"
        maxLength={2}
        placeholder="HH"
        className="w-[22px] border-0 bg-transparent p-0 text-center focus:outline-none focus:ring-0"
      />
      <span className="select-none text-neutral-500">:</span>
      <input
        ref={mmRef}
        type="text"
        value={mm}
        onChange={onMmChange}
        onKeyDown={onMmKeyDown}
        inputMode="numeric"
        maxLength={2}
        placeholder="MM"
        className="w-[22px] border-0 bg-transparent p-0 text-center focus:outline-none focus:ring-0"
      />
      <input type="hidden" name={name} value={`${hh}:${mm}`} />
    </span>
  );
}
