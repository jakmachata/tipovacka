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

function colorForScore(
  distance: number | null,
  min: number,
  max: number,
): string {
  if (distance === null) return "bg-neutral-50 text-neutral-400";
  if (max === min) return "bg-emerald-100 text-emerald-900";
  // Normalize 0..1 (0 = most similar / low distance, 1 = most different)
  const t = (distance - min) / (max - min);
  // Color: emerald (low) -> amber (mid) -> rose (high)
  if (t < 0.33) return "bg-emerald-100 text-emerald-900";
  if (t < 0.66) return "bg-amber-100 text-amber-900";
  return "bg-rose-100 text-rose-900";
}

export default async function PodobnostPage({
  searchParams,
}: {
  searchParams: Promise<{ sortBy?: string }>;
}) {
  const sp = await searchParams;
  const sortByUserId = sp.sortBy ?? null;

  const supabase = await createClient();
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

  // Fetch all approved players + admins (anyone who can tip)
  const { data: profilesData } = await supabase
    .from("profiles")
    .select("id, display_name, is_admin, bg_color, text_color")
    .eq("is_approved", true)
    .order("display_name");
  const profiles = (profilesData ?? []) as Profile[];

  // Fetch all picks — admin has RLS access to everything.
  const { data: picksData } = await supabase
    .from("picks")
    .select("user_id, match_id, home_score, away_score");
  const picks = (picksData ?? []) as Pick[];

  // Build picks-per-user map: user_id -> Map<match_id, {naskok, goly}>
  const userTips = new Map<string, Map<number, { naskok: number; goly: number }>>();
  for (const p of picks) {
    if (p.home_score == null || p.away_score == null) continue;
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

  // Keep only players who have at least one pick.
  const playersWithPicks = profiles.filter((p) => userTips.has(p.id));

  // Compute NxN distance matrix.
  const N = playersWithPicks.length;
  const matrix: Array<Array<number | null>> = [];
  let minDist = Infinity;
  let maxDist = -Infinity;
  for (let i = 0; i < N; i++) {
    matrix.push([]);
    for (let j = 0; j < N; j++) {
      if (i === j) {
        matrix[i].push(null); // self
        continue;
      }
      const tipsA = userTips.get(playersWithPicks[i].id)!;
      const tipsB = userTips.get(playersWithPicks[j].id)!;
      let sum = 0;
      let count = 0;
      for (const [matchId, tipA] of tipsA) {
        const tipB = tipsB.get(matchId);
        if (!tipB) continue;
        sum +=
          Math.abs(tipA.naskok - tipB.naskok) +
          Math.abs(tipA.goly - tipB.goly);
        count++;
      }
      const d = count === 0 ? null : sum;
      matrix[i].push(d);
      if (d !== null) {
        if (d < minDist) minDist = d;
        if (d > maxDist) maxDist = d;
      }
    }
  }

  // Determine row order based on sortByUserId.
  let rowOrder = playersWithPicks.map((_, i) => i);
  if (sortByUserId) {
    const colIdx = playersWithPicks.findIndex((p) => p.id === sortByUserId);
    if (colIdx >= 0) {
      rowOrder = rowOrder.slice().sort((a, b) => {
        const da = matrix[a][colIdx];
        const db = matrix[b][colIdx];
        if (da === null && db === null) return 0;
        if (da === null) return 1;
        if (db === null) return -1;
        return da - db;
      });
    }
  }

  return (
    <main>
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
                const style: React.CSSProperties = {};
                if (p.bg_color) style.backgroundColor = p.bg_color;
                if (p.text_color) style.color = p.text_color;
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
              const rowStyle: React.CSSProperties = {};
              if (rowPlayer.bg_color) rowStyle.backgroundColor = rowPlayer.bg_color;
              if (rowPlayer.text_color) rowStyle.color = rowPlayer.text_color;
              return (
                <tr key={rowPlayer.id} className="border-b">
                  <td
                    className="sticky left-0 z-10 bg-white py-2 pr-3 font-medium"
                  >
                    <span
                      className="inline-block rounded px-1.5"
                      style={rowStyle}
                    >
                      {rowPlayer.display_name}
                    </span>
                  </td>
                  {playersWithPicks.map((_, colIdx) => {
                    const d = matrix[rowIdx][colIdx];
                    const cls = colorForScore(d, minDist, maxDist);
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
    </main>
  );
}
