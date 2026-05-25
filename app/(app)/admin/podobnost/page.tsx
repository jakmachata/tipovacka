import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

interface Pick {
  user_id: string;
  match_id: number;
  home_score: number;
  away_score: number;
}

interface Profile {
  id: string;
  display_name: string;
  is_admin: boolean | null;
  bg_color: string | null;
  text_color: string | null;
}

// Fallback paleta (stejna jako v tip-matrix HEADER_COLORS / chat FALLBACK_COLORS)
const FALLBACK_COLORS: Array<{ bg: string; text: string }> = [
  { bg: "#e11d48", text: "#ffffff" }, // rose-600
  { bg: "#ea580c", text: "#ffffff" }, // orange-600
  { bg: "#ca8a04", text: "#ffffff" }, // yellow-600
  { bg: "#65a30d", text: "#ffffff" }, // lime-600
  { bg: "#16a34a", text: "#ffffff" }, // green-600
  { bg: "#059669", text: "#ffffff" }, // emerald-600
  { bg: "#0891b2", text: "#ffffff" }, // cyan-600
  { bg: "#0284c7", text: "#ffffff" }, // sky-600
  { bg: "#2563eb", text: "#ffffff" }, // blue-600
  { bg: "#4f46e5", text: "#ffffff" }, // indigo-600
  { bg: "#7c3aed", text: "#ffffff" }, // violet-600
  { bg: "#9333ea", text: "#ffffff" }, // purple-600
  { bg: "#c026d3", text: "#ffffff" }, // fuchsia-600
  { bg: "#db2777", text: "#ffffff" }, // pink-600
  { bg: "#475569", text: "#ffffff" }, // slate-600
];

function fallbackFor(id: string): { bg: string; text: string } {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return FALLBACK_COLORS[h % FALLBACK_COLORS.length];
}

function colorsFor(p: Profile): { bg: string; text: string } {
  if (p.bg_color && p.text_color) return { bg: p.bg_color, text: p.text_color };
  return fallbackFor(p.id);
}

// 5-pasmova skala: nejnizsi (=nejpodobnejsi) zelena, dale lime/amber/orange, az rose (nejvic odlisne)
function colorForScore(
  distance: number | null,
  min: number,
  max: number,
): string {
  if (distance === null) return "";
  const t = max === min ? 0.5 : (distance - min) / (max - min);
  if (t < 0.20) return "bg-emerald-200 text-emerald-900";
  if (t < 0.40) return "bg-lime-100 text-lime-900";
  if (t < 0.60) return "bg-amber-100 text-amber-900";
  if (t < 0.80) return "bg-orange-200 text-orange-900";
  return "bg-rose-200 text-rose-900";
}

export default async function PodobnostPage({
  searchParams,
}: {
  searchParams: Promise<{ sortBy?: string }>;
}) {
  const supabase = await createClient();
  const { sortBy: sortByUserId } = await searchParams;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: meProfile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!meProfile?.is_admin) redirect("/");

  const { data: profilesData } = await supabase
    .from("profiles")
    .select("id, display_name, is_admin, bg_color, text_color")
    .eq("is_approved", true)
    .order("display_name", { ascending: true });
  const profiles: Profile[] = profilesData ?? [];

  const { data: picksData } = await supabase
    .from("picks")
    .select("user_id, match_id, home_score, away_score");
  const picks: Pick[] = picksData ?? [];

  // Mapa user_id -> Map<match_id, {naskok, goly}>
  const userTips = new Map<string, Map<number, { naskok: number; goly: number }>>();
  for (const p of picks) {
    if (p.home_score === null || p.away_score === null) continue;
    let map = userTips.get(p.user_id);
    if (!map) {
      map = new Map();
      userTips.set(p.user_id, map);
    }
    map.set(p.match_id, {
      naskok: p.home_score - p.away_score,
      goly: p.home_score + p.away_score,
    });
  }

  // Pouze hraci kteri maji aspon jeden tip
  const playersWithPicks = profiles.filter((p) => {
    const t = userTips.get(p.id);
    return t && t.size > 0;
  });

  const n = playersWithPicks.length;
  const matrix: (number | null)[][] = Array.from({ length: n }, () =>
    Array.from({ length: n }, () => null),
  );

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const a = userTips.get(playersWithPicks[i].id)!;
      const b = userTips.get(playersWithPicks[j].id)!;
      let sum = 0;
      let count = 0;
      for (const [matchId, tipA] of a.entries()) {
        const tipB = b.get(matchId);
        if (!tipB) continue;
        sum +=
          Math.abs(tipA.naskok - tipB.naskok) +
          Math.abs(tipA.goly - tipB.goly);
        count++;
      }
      matrix[i][j] = count > 0 ? sum : null;
    }
  }

  // Min/max for color scaling (ignore null + diagonal)
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const v = matrix[i][j];
      if (v === null) continue;
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  if (!isFinite(min)) min = 0;
  if (!isFinite(max)) max = 0;

  // Top 20 paru (i < j, ignore null, sort asc)
  const pairs: { i: number; j: number; d: number }[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const v = matrix[i][j];
      if (v === null) continue;
      pairs.push({ i, j, d: v });
    }
  }
  pairs.sort((a, b) => a.d - b.d);
  const top20 = pairs.slice(0, 20);

  // Row order (sort by similarity to sortByUserId column)
  let rowOrder = playersWithPicks.map((_, i) => i);
  if (sortByUserId) {
    const sortColIdx = playersWithPicks.findIndex((p) => p.id === sortByUserId);
    if (sortColIdx >= 0) {
      rowOrder.sort((a, b) => {
        if (a === sortColIdx) return -1;
        if (b === sortColIdx) return 1;
        const va = matrix[a][sortColIdx];
        const vb = matrix[b][sortColIdx];
        if (va === null && vb === null) return 0;
        if (va === null) return 1;
        if (vb === null) return -1;
        return va - vb;
      });
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-3 py-4">
      <div className="mb-3 flex items-center gap-3">
        <Link
          href="/hraci"
          className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-50"
        >
          ← Zpět na Hráče a aktivitu
        </Link>
      </div>
      <h1 className="mb-2 text-xl font-semibold">Tipová podobnost hráčů</h1>
      <p className="mb-4 text-xs text-neutral-500">
        Číslo v buňce = součet rozdílů náskoku a celkových gólů přes všechny
        zápasy, kde oba tipovali. Nižší = podobnější tipy. Klikni na jméno
        v hlavičce sloupce pro seřazení řádků podle podobnosti k tomu hráči.
      </p>

      <div className="overflow-x-auto">
        <table className="text-xs">
          <thead className="border-b text-left text-neutral-500">
            <tr>
              <th className="sticky left-0 z-10 bg-white py-2 pr-3">Hráč</th>
              {playersWithPicks.map((p) => {
                const isActive = sortByUserId === p.id;
                const c = colorsFor(p);
                const style = {
                  backgroundColor: c.bg,
                  color: c.text,
                };
                return (
                  <th
                    key={p.id}
                    className={
                      "cursor-pointer select-none px-2 py-2 text-center font-medium hover:opacity-80 " +
                      (isActive ? "ring-2 ring-sky-500" : "")
                    }
                    style={style}
                  >
                    <Link href={`/admin/podobnost?sortBy=${p.id}`}>
                      {p.display_name}
                    </Link>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rowOrder.map((rowIdx) => {
              const rowPlayer = playersWithPicks[rowIdx];
              const rc = colorsFor(rowPlayer);
              const rowStyle = {
                backgroundColor: rc.bg,
                color: rc.text,
              };
              return (
                <tr key={rowPlayer.id} className="border-b">
                  <td className="sticky left-0 z-10 bg-white py-2 pr-3 font-medium">
                    <span
                      className="inline-block rounded px-1.5"
                      style={rowStyle}
                    >
                      {rowPlayer.display_name}
                    </span>
                  </td>
                  {playersWithPicks.map((_, colIdx) => {
                    const d = matrix[rowIdx][colIdx];
                    const cls = colorForScore(d, min, max);
                    return (
                      <td
                        key={colIdx}
                        className={"px-2 py-2 text-center tabular-nums " + cls}
                      >
                        {d === null
                          ? rowIdx === colIdx
                            ? "—"
                            : "·"
                          : d}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2 className="mt-8 mb-2 text-base font-semibold">Top 20 nejpodobnějších párů</h2>
      <p className="mb-3 text-xs text-neutral-500">
        Seřazeno od nejmenší vzdálenosti (#1 = nejpodobnější dvojice tipérů).
      </p>
      <div className="overflow-x-auto">
        <table className="text-xs">
          <thead className="border-b text-left text-neutral-500">
            <tr>
              <th className="py-2 pr-3 w-[40px]">#</th>
              <th className="py-2 pr-3">Hráč A</th>
              <th className="py-2 pr-3">Hráč B</th>
              <th className="py-2 pr-3 text-right">Vzdálenost</th>
            </tr>
          </thead>
          <tbody>
            {top20.map((p, idx) => {
              const a = playersWithPicks[p.i];
              const b = playersWithPicks[p.j];
              const ca = colorsFor(a);
              const cb = colorsFor(b);
              return (
                <tr key={`${a.id}-${b.id}`} className="border-b">
                  <td className="py-1.5 pr-3 font-medium tabular-nums">{idx + 1}</td>
                  <td className="py-1.5 pr-3">
                    <span
                      className="inline-block rounded px-1.5"
                      style={{ backgroundColor: ca.bg, color: ca.text }}
                    >
                      {a.display_name}
                    </span>
                  </td>
                  <td className="py-1.5 pr-3">
                    <span
                      className="inline-block rounded px-1.5"
                      style={{ backgroundColor: cb.bg, color: cb.text }}
                    >
                      {b.display_name}
                    </span>
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{p.d}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
