import { createClient } from "@/lib/supabase/server";
import type { LeaderboardRow } from "@/lib/types";

export default async function LeaderboardPage() {
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("leaderboard")
    .select("*")
    .order("total", { ascending: false });

  return (
    <main>
      <h1 className="mb-6 text-2xl font-semibold">Pořadí</h1>
      <table className="w-full text-sm">
        <thead className="border-b text-left text-neutral-500">
          <tr>
            <th className="py-2">#</th>
            <th>Hráč</th>
            <th className="text-right">Handicap</th>
            <th className="text-right">Přesný 60′</th>
            <th className="text-right">1. třetina</th>
            <th className="text-right font-semibold">Celkem</th>
          </tr>
        </thead>
        <tbody>
          {(rows as LeaderboardRow[] | null ?? []).map((r, i) => (
            <tr key={r.user_id} className="border-b">
              <td className="py-2 tabular-nums text-neutral-500">{i + 1}.</td>
              <td className="font-medium">{r.display_name}</td>
              <td className="text-right tabular-nums">{r.hcp_total}</td>
              <td className="text-right tabular-nums">{r.exact_total}</td>
              <td className="text-right tabular-nums">{r.p1_total}</td>
              <td className="text-right font-semibold tabular-nums">{r.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
