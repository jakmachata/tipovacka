"use client";

import { useEffect, useRef, useState } from "react";

const pad = (n: number) => String(n).padStart(2, "0");

export function TimePicker({
  name,
  defaultValue,
}: {
  name: string;
  defaultValue: string; // "HH:MM"
}) {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const [hh, mm] = value.split(":");

  return (
    <div className="relative" ref={wrapperRef}>
      <input type="hidden" name={name} value={value} />
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="rounded border bg-white px-2 py-1 tabular-nums hover:bg-neutral-50"
      >
        {value}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 flex gap-2 rounded border bg-white p-2 shadow-lg">
          <div>
            <div className="mb-1 text-[10px] uppercase tracking-wide text-neutral-500">
              Hodina
            </div>
            <div className="grid grid-cols-6 gap-0.5">
              {Array.from({ length: 24 }).map((_, h) => {
                const v = pad(h);
                const isSel = v === hh;
                return (
                  <button
                    type="button"
                    key={h}
                    onClick={() => setValue(`${v}:${mm}`)}
                    className={
                      "rounded px-2 py-1 text-center tabular-nums " +
                      (isSel
                        ? "bg-neutral-900 text-white"
                        : "hover:bg-neutral-100")
                    }
                  >
                    {v}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="border-l pl-2">
            <div className="mb-1 text-[10px] uppercase tracking-wide text-neutral-500">
              Minuta
            </div>
            <div className="grid grid-cols-4 gap-0.5">
              {Array.from({ length: 12 }).map((_, i) => {
                const v = pad(i * 5);
                const isSel = v === mm;
                return (
                  <button
                    type="button"
                    key={v}
                    onClick={() => {
                      setValue(`${hh}:${v}`);
                      setOpen(false);
                    }}
                    className={
                      "rounded px-2 py-1 text-center tabular-nums " +
                      (isSel
                        ? "bg-neutral-900 text-white"
                        : "hover:bg-neutral-100")
                    }
                  >
                    {v}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
