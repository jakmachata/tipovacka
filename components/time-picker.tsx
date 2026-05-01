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

  const cellCls = (sel: boolean) =>
    "w-10 px-2 py-0.5 text-center tabular-nums leading-tight " +
    (sel ? "bg-neutral-900 text-white" : "hover:bg-neutral-100");

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
        <div className="absolute left-0 top-full z-30 mt-1 flex rounded border bg-white shadow-lg">
          <div className="border-r">
            {Array.from({ length: 24 }).map((_, h) => {
              const v = pad(h);
              return (
                <button
                  type="button"
                  key={h}
                  onClick={() => setValue(`${v}:${mm}`)}
                  className={"block " + cellCls(v === hh)}
                >
                  {v}
                </button>
              );
            })}
          </div>
          <div>
            {Array.from({ length: 12 }).map((_, i) => {
              const v = pad(i * 5);
              return (
                <button
                  type="button"
                  key={v}
                  onClick={() => {
                    setValue(`${hh}:${v}`);
                    setOpen(false);
                  }}
                  className={"block " + cellCls(v === mm)}
                >
                  {v}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
