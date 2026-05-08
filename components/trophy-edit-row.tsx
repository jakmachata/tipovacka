"use client";

import { useEffect, useRef, useState } from "react";

interface Trophy {
  id: number;
  event_name: string;
  gold: string | null;
  silver: string | null;
  bronze: string | null;
  gold_points: number | null;
  silver_points: number | null;
  bronze_points: number | null;
  daily_ideal_1: number | null;
  daily_ideal_2: number | null;
  display_order: number | null;
  notes: string | null;
}

interface Props {
  trophy: Trophy;
  isFirst: boolean;
  isLast: boolean;
  updateAction: (formData: FormData) => Promise<void>;
  deleteAction: (formData: FormData) => Promise<void>;
  moveAction: (formData: FormData) => Promise<void>;
}

function fmt(name: string | null, points: number | null) {
  if (!name) return null;
  if (points == null) return name;
  return name + " (" + points + " b.)";
}

export function TrophyEditRow({
  trophy: t,
  isFirst,
  isLast,
  updateAction,
  deleteAction,
  moveAction,
}: Props) {
  const [saved, setSaved] = useState(false);
  const detailsRef = useRef<HTMLDetailsElement>(null);

  // Auto-skryj "Uloženo ✓" po 3 vteřinách.
  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 3000);
    return () => clearTimeout(t);
  }, [saved]);

  async function handleSave(formData: FormData) {
    await updateAction(formData);
    if (detailsRef.current) detailsRef.current.open = false;
    setSaved(true);
  }

  return (
    <li className="rounded border p-3 text-sm">
      <details ref={detailsRef}>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
          <div className="flex flex-col items-center gap-1">
            <form action={moveAction}>
              <input type="hidden" name="id" value={t.id} />
              <input type="hidden" name="direction" value="up" />
              <button
                type="submit"
                disabled={isFirst}
                title="Posunout nahoru"
                aria-label="Posunout nahoru"
                className="rounded border px-1.5 py-0.5 text-xs text-neutral-600 hover:bg-neutral-100 disabled:opacity-30"
              >
                ▲
              </button>
            </form>
            <form action={moveAction}>
              <input type="hidden" name="id" value={t.id} />
              <input type="hidden" name="direction" value="down" />
              <button
                type="submit"
                disabled={isLast}
                title="Posunout dolů"
                aria-label="Posunout dolů"
                className="rounded border px-1.5 py-0.5 text-xs text-neutral-600 hover:bg-neutral-100 disabled:opacity-30"
              >
                ▼
              </button>
            </form>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 font-semibold">
              {t.event_name}
              {saved && (
                <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-normal text-emerald-800">
                  Uloženo ✓
                </span>
              )}
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-neutral-600">
              {t.gold && <span>1. {fmt(t.gold, t.gold_points)}</span>}
              {t.silver && <span>2. {fmt(t.silver, t.silver_points)}</span>}
              {t.bronze && <span>3. {fmt(t.bronze, t.bronze_points)}</span>}
            </div>
            {(t.daily_ideal_1 != null || t.daily_ideal_2 != null) && (
              <div className="mt-1 text-xs text-neutral-500">
                Daily&apos;s ideals:{" "}
                {t.daily_ideal_1 != null
                  ? "#1 = " + t.daily_ideal_1
                  : "#1 —"}
                {", "}
                {t.daily_ideal_2 != null
                  ? "#2 = " + t.daily_ideal_2
                  : "#2 —"}
              </div>
            )}
            {t.notes && (
              <div className="mt-1 text-xs text-neutral-500">{t.notes}</div>
            )}
          </div>
          <span className="rounded bg-neutral-100 px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-200">
            Upravit
          </span>
        </summary>

        <form
          action={handleSave}
          className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2"
        >
          <input type="hidden" name="id" value={t.id} />
          <label className="text-sm md:col-span-2">
            <span className="block text-xs text-neutral-500">
              Název soutěže
            </span>
            <input
              name="event_name"
              type="text"
              defaultValue={t.event_name}
              required
              className="w-full rounded border px-2 py-1.5 text-sm"
            />
          </label>

          <label className="text-sm">
            <span className="block text-xs text-neutral-500">Vítěz</span>
            <input
              name="gold"
              type="text"
              defaultValue={t.gold ?? ""}
              className="w-full rounded border px-2 py-1.5 text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="block text-xs text-neutral-500">Body vítěze</span>
            <input
              name="gold_points"
              type="number"
              inputMode="numeric"
              defaultValue={t.gold_points ?? ""}
              className="w-full rounded border px-2 py-1.5 text-sm"
            />
          </label>

          <label className="text-sm">
            <span className="block text-xs text-neutral-500">Druhé místo</span>
            <input
              name="silver"
              type="text"
              defaultValue={t.silver ?? ""}
              className="w-full rounded border px-2 py-1.5 text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="block text-xs text-neutral-500">Body druhého</span>
            <input
              name="silver_points"
              type="number"
              inputMode="numeric"
              defaultValue={t.silver_points ?? ""}
              className="w-full rounded border px-2 py-1.5 text-sm"
            />
          </label>

          <label className="text-sm">
            <span className="block text-xs text-neutral-500">Třetí místo</span>
            <input
              name="bronze"
              type="text"
              defaultValue={t.bronze ?? ""}
              className="w-full rounded border px-2 py-1.5 text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="block text-xs text-neutral-500">Body třetího</span>
            <input
              name="bronze_points"
              type="number"
              inputMode="numeric"
              defaultValue={t.bronze_points ?? ""}
              className="w-full rounded border px-2 py-1.5 text-sm"
            />
          </label>

          <label className="text-sm">
            <span className="block text-xs text-neutral-500">
              Daily&apos;s ideal #1
            </span>
            <input
              name="daily_ideal_1"
              type="number"
              inputMode="decimal"
              step="0.01"
              defaultValue={t.daily_ideal_1 ?? ""}
              className="w-full rounded border px-2 py-1.5 text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="block text-xs text-neutral-500">
              Daily&apos;s ideal #2
            </span>
            <input
              name="daily_ideal_2"
              type="number"
              inputMode="decimal"
              step="0.01"
              defaultValue={t.daily_ideal_2 ?? ""}
              className="w-full rounded border px-2 py-1.5 text-sm"
            />
          </label>

          <label className="text-sm md:col-span-2">
            <span className="block text-xs text-neutral-500">Poznámka</span>
            <input
              name="notes"
              type="text"
              defaultValue={t.notes ?? ""}
              className="w-full rounded border px-2 py-1.5 text-sm"
            />
          </label>

          <div className="flex items-center gap-3 md:col-span-2">
            <button
              type="submit"
              className="rounded bg-black px-4 py-2 text-sm text-white hover:bg-neutral-800"
            >
              Uložit změny
            </button>
          </div>
        </form>

        <form action={deleteAction} className="mt-3">
          <input type="hidden" name="id" value={t.id} />
          <button
            title="Smazat záznam"
            className="rounded bg-rose-100 px-2 py-1 text-xs text-rose-700 hover:bg-rose-200"
          >
            Smazat záznam
          </button>
        </form>
      </details>
    </li>
  );
}
