import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { STAGE_LABEL, type Match, type Team } from "@/lib/types";

export default async function MatchDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const matchId = Number(id);
  const supabase = await createClient();

  const { data: match } = await supabase.from("matches").select("*").eq("id", matchId).single();
  if (!match) notFound();
  const m = match as Match;

  const [{ data: teams }, { data: picks }, { data: scores }] = await Promise.all([
    supabase.from("teams").select("*"),
    supabase.from("picks").select("*, profiles!inner(display_name)").eq("match_id", matchId),
    supabase.from("scores").select("*, profiles!inner(display_name)").eq("match_id", matchId),
  ]);

  const teamMap = new Map((teams ?? []).map((t) => [t.code, t as Team]));
  const home = teamMap.get(m.home_code);
  const away = teamMap.get(m.away_code);
  const scoreMap = new Map((scores ?? []).map((s: any) => [s.user_id, s]));

  return (
    <main>
      <h1 className="text-2xl font-semibold">
        {home?.flag_emoji} {home?.name_cs} vs {away?.flag_emoji} {away?.name_cs}
      </h1>
      <p className="mt-1 text-sm text-neutral-600">
        {STAGE_LABEL[m.stage]} · {new Date(m.starts_at).toLocaleString("cs-CZ")}
        {m.home_handicap !== null && ` · handicap domácích ${m.home_handicap > 0 ? "+" : ""}${m.home_handicap}`}
      </p>
      {m.finalized && (
        <p className="mt-2 text-lg">
          Výsledek: <strong>{m.home_score}:{m.away_score}</strong>
          {m.home_score_p1 != null && (
            <span className="ml-2 text-sm text-neutral-500">
              (1. třetina {m.home_score_p1}:{m.away_score_p1})
            </span>
          )}
        </p>
      )}

      <h2 className="mt-8 mb-3 text-lg font-semibold">Tipy</h2>
      <table className="w-full text-sm">
        <thead className="border-b text-left text-neutral-500">
          <tr>
            <th className="py-2">Hráč</th>
            <th>Tip 60′</th>
            <th>Tip 1. třetina</th>
            <th className="text-right">Body</th>
          </tr>
        </thead>
        <tbody>
          {(picks ?? []).map((p: any) => {
            const s = scoreMap.get(p.user_id);
            return (
              <tr key={p.user_id} className="border-b">
                <td className="py-2">{p.profiles.display_name}</td>
                <td>
                  {p.home_score}:{p.away_score}
                </td>
                <td>
                  {p.home_score_p1 != null ? `${p.home_score_p1}:${p.away_score_p1}` : "—"}
                </td>
                <td className="text-right tabular-nums">
                  {s ? `${s.total_points} (${s.hcp_points}+${s.exact_points}+${s.p1_points})` : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </main>
  );
}
