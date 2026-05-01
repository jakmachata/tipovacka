import { createClient } from "@/lib/supabase/server";
import { TipMatrix } from "@/components/tip-matrix";
import type { Profile } from "@/lib/types";

export default async function SchedulePage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

  const [matchesRes, teamsRes, profilesRes, picksRes, scoresRes, leaderboardRes] = await Promise.all([
        supabase.from("matches").select("*").order("starts_at"),
        supabase.from("teams").select("*"),
        supabase.from("profiles").select("*").eq("is_approved", true).eq("is_admin", false).order("display_name"),
        supabase.from("picks").select("*"),
        supabase.from("scores").select("*"),
        supabase.from("leaderboard").select("*"),
      ]);

  const totals = new Map((leaderboardRes.data ?? []).map((r) => [r.user_id, r.total]));
    const players = ((profilesRes.data ?? []) as Profile[]).map((p) => ({ ...p, total: totals.get(p.id) ?? 0 }));

  return (
        <TipMatrix
                myUserId={user!.id}
                matches={matchesRes.data ?? []}
                teams={teamsRes.data ?? []}
                players={players}
                picks={picksRes.data ?? []}
                scores={scoresRes.data ?? []}
              />
      );
}
