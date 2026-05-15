import { createClient, createServiceClient } from "@/lib/supabase/server";
import { TipMatrix } from "@/components/tip-matrix";
import type { Profile } from "@/lib/types";

export default async function SchedulePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Pro hosta isAdmin=false, myUserId=null. Pro přihlášeného načteme profil.
  let isAdmin = false;
  if (user) {
    const { data: meProfile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();
    isAdmin = !!meProfile?.is_admin;
  }

  const threeMinAgo = new Date(Date.now() - 3 * 60 * 1000).toISOString();
  const [
    matchesRes,
    teamsRes,
    profilesRes,
    picksRes,
    scoresRes,
    leaderboardRes,
    activeRes,
    pendingRes,
  ] = await Promise.all([
    supabase.from("matches").select("*").not("starts_at", "is", null).order("starts_at"),
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
    supabase
      .from("profiles")
      .select("id, display_name, last_seen_at, is_admin")
      .eq("is_approved", true)
      .gte("last_seen_at", threeMinAgo)
      .order("last_seen_at", { ascending: false }),
    supabase.from("pending_picks").select("*").eq("status", "pending"),
  ]);

  // Pickovaná políčka pro každého hráče — pro non-admin viewers načteme přes
  // service client, aby viděli zámeček u políček, kde jiný hráč již tipoval
  // (RLS jinak skrývá cizí picks). Voláme jen pokud nejsi admin (admin už má
  // celé picksRes přes RLS).
  let pickExistence: Array<{ user_id: string; match_id: number }> = [];
  if (!isAdmin) {
    const adminSb = createServiceClient();
    const { data: existenceData } = await adminSb
      .from("picks")
      .select("user_id, match_id");
    pickExistence = (existenceData ?? []) as Array<{ user_id: string; match_id: number }>;
  }

  const totals = new Map(
    (leaderboardRes.data ?? []).map((r: { user_id: string; total: number }) => [
      r.user_id,
      r.total,
    ]),
  );

  // Pořadí sloupců: přihlášený první (pokud je hráč), ostatní podle bodů (sestupně),
  // pak abecedně. Host (no user) = jen seřazení podle bodů.
  const myId = user?.id ?? null;
  // Oblíbení tipéři (sync across devices přes profiles.favorites).
  let myFavorites: string[] = [];
  if (myId) {
    const { data: meRow } = await supabase
      .from("profiles")
      .select("favorites")
      .eq("id", myId)
      .maybeSingle();
    myFavorites = ((meRow as any)?.favorites as string[] | null) ?? [];
  }
  const players = ((profilesRes.data ?? []) as Profile[])
    .map((p) => ({ ...p, total: totals.get(p.id) ?? 0 }))
    .sort((a, b) => {
      if (myId) {
        if (a.id === myId) return -1;
        if (b.id === myId) return 1;
      }
      const t = (b.total ?? 0) - (a.total ?? 0);
      if (t !== 0) return t;
      return a.display_name.localeCompare(b.display_name, "cs");
    });

  const activeUsers = (activeRes.data ?? []) as Array<{
    id: string;
    display_name: string;
    last_seen_at: string | null;
  }>;

  return (
    <TipMatrix
      myUserId={myId}
      isAdmin={isAdmin}
      matches={matchesRes.data ?? []}
      teams={teamsRes.data ?? []}
      players={players}
      picks={picksRes.data ?? []}
      scores={scoresRes.data ?? []}
      activeUsers={activeUsers}
      pendingPicks={pendingRes.data ?? []}
      myFavorites={myFavorites}
      pickExistence={pickExistence}
    />
  );
}
