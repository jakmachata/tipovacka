import { createClient } from "@/lib/supabase/server";
import { TipMatrix } from "@/components/tip-matrix";
import type { Profile } from "@/lib/types";

export default async function SchedulePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: meProfile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user!.id)
    .single();
  const isAdmin = !!meProfile?.is_admin;

  const [matchesRes, teamsRes, profilesRes, picksRes, scoresRes, leaderboardRes] =
    await Promise.all([
      supabase.from("matches").select("*").order("starts_at"),
      supabase.from("teams").select("*"),
      supabase
        .from("profiles")
        .select("*")
        .eq("is_approved", true)
        .eq("is_player", true)
        .order("display_name"),
      supabase.from("picks").select("*"),
      supabase.from("scores").select("*"),
      supabase.from("leaderboard").select("*"),
    ]);

  const totals = new Map(
    (leaderboardRes.data ?? []).map((r: { user_id: string; total: number }) => [
      r.user_id,
      r.total,
    ]),
  );

  // Pořadí sloupců: přihlášený první, ostatní podle aktuálních bodů (sestupně),
  // pak abecedně podle jména pro stabilitu.
  const myId = user!.id;
  const players = ((profilesRes.data ?? []) as Profile[])
    .map((p) => ({ ...p, total: totals.get(p.id) ?? 0 }))
    .sort((a, b) => {
      if (a.id === myId) return -1;
      if (b.id === myId) return 1;
      const t = (b.total ?? 0) - (a.total ?? 0);
      if (t !== 0) return t;
      return a.display_name.localeCompare(b.display_name, "cs");
    });

  return (
    <TipMatrix
      myUserId={myId}
      isAdmin={isAdmin}
      matches={matchesRes.data ?? []}
      teams={teamsRes.data ?? []}
      players={players}
      picks={picksRes.data ?? []}
      scores={scoresRes.data ?? []}
    />
  );
}
