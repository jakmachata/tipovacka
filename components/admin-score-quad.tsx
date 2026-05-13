"use client";

import { useRef, type ChangeEvent, type KeyboardEvent } from "react";

interface Props {
  homeDefault: number | null;
  awayDefault: number | null;
  homeP1Default: number | null;
  awayP1Default: number | null;
}

function clamp2(v: string) {
  // Accept "" or 1-2 digits
  if (v === "") return "";
  if (!/^\d{1,2}$/.test(v)) return v.replace(/[^\d]/g, "").slice(0, 2);
  return v;
}

export function AdminScoreQuad({
  homeDefault,
  awayDefault,
  homeP1Default,
  awayP1Default,
}: Props) {
  const refs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  function focusNext(idx: number) {
    const next = refs[idx + 1]?.current;
    if (next) {
      next.focus();
      next.select();
    }
  }

  function handleInput(idx: number, e: ChangeEvent<HTMLInputElement>) {
    const el = e.currentTarget;
    const cleaned = clamp2(el.value);
    if (cleaned !== el.value) el.value = cleaned;
    // Auto-advance when one digit is entered
    if (cleaned.length === 1 && idx < 3) {
      focusNext(idx);
    } else if (cleaned.length === 2 && idx < 3) {
      focusNext(idx);
    }
  }

  function handleKeyDown(idx: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowRight" && idx < 3) {
      const el = e.currentTarget;
      if (el.selectionStart === el.value.length) {
        e.preventDefault();
        focusNext(idx);
      }
    } else if (e.key === "ArrowLeft" && idx > 0) {
      const el = e.currentTarget;
      if (el.selectionStart === 0) {
        e.preventDefault();
        const prev = refs[idx - 1]?.current;
        if (prev) {
          prev.focus();
          prev.setSelectionRange(prev.value.length, prev.value.length);
        }
      }
    }
  }

  const cls =
    "w-10 rounded border px-1.5 py-1 text-center text-sm [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

  return (
    <>
      <label className="flex w-fit flex-col items-center text-xs text-neutral-600">
        Skóre 60′
        <div className="mt-0.5 flex items-center gap-1">
          <input
            ref={refs[0]}
            name="home_score"
            type="text"
            inputMode="numeric"
            maxLength={2}
            defaultValue={homeDefault ?? ""}
            onInput={(e) => handleInput(0, e)}
            onKeyDown={(e) => handleKeyDown(0, e)}
            onFocus={(e) => e.currentTarget.select()}
            className={cls}
          />
          <span>:</span>
          <input
            ref={refs[1]}
            name="away_score"
            type="text"
            inputMode="numeric"
            maxLength={2}
            defaultValue={awayDefault ?? ""}
            onInput={(e) => handleInput(1, e)}
            onKeyDown={(e) => handleKeyDown(1, e)}
            onFocus={(e) => e.currentTarget.select()}
            className={cls}
          />
        </div>
      </label>
      <label className="flex w-fit flex-col items-center text-xs text-neutral-600">
        1. třetina
        <div className="mt-0.5 flex items-center gap-1">
          <input
            ref={refs[2]}
            name="home_score_p1"
            type="text"
            inputMode="numeric"
            maxLength={2}
            defaultValue={homeP1Default ?? ""}
            onInput={(e) => handleInput(2, e)}
            onKeyDown={(e) => handleKeyDown(2, e)}
            onFocus={(e) => e.currentTarget.select()}
            className={cls}
          />
          <span>:</span>
          <input
            ref={refs[3]}
            name="away_score_p1"
            type="text"
            inputMode="numeric"
            maxLength={2}
            defaultValue={awayP1Default ?? ""}
            onInput={(e) => handleInput(3, e)}
            onKeyDown={(e) => handleKeyDown(3, e)}
            onFocus={(e) => e.currentTarget.select()}
            className={cls}
          />
        </div>
      </label>
    </>
  );
}
