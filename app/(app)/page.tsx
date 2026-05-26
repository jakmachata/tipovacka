import { createClient, createServiceClient } from "@/lib/supabase/server";
import { TipMatrix } from "@/components/tip-matrix";
import { Chat, type ChatMessage, type ChatProfileInfo } from "@/components/chat";
import { StatsTicker, type TickerCard } from "@/components/stats-ticker";
import type { Profile } from "@/lib/types";

export default async function SchedulePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Pro hosta isAdmin=false, myUserId=null. Pro přihlášeného načteme profil.
  let isAdmin = false;
  let canChat = false;
  if (user) {
    const { data: meProfile } = await supabase
      .from("profiles")
      .select("is_admin, is_approved, is_rejected")
      .eq("id", user.id)
      .single();
    isAdmin = !!meProfile?.is_admin;
    canChat = isAdmin || (!!meProfile?.is_approved && !meProfile?.is_rejected);
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
    chatMessagesRes,
    chatProfilesRes,
    metricsRes,
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
    user
      ? supabase
          .from("chat_messages")
          .select("id, user_id, content, created_at, edited_at")
          .order("created_at", { ascending: true })
          .limit(100)
      : Promise.resolve({ data: [] as ChatMessage[] }),
    user
      ? supabase
          .from("profiles")
          .select("id, display_name, is_admin, bg_color, text_color")
      : Promise.resolve({ data: [] as Array<{ id: string; display_name: string; is_admin: boolean; bg_color: string | null; text_color: string | null }> }),
    createServiceClient().from("user_tip_metrics").select("*"),
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

  const chatProfileMap: Record<string, ChatProfileInfo> = {};
  for (const p of (chatProfilesRes?.data ?? []) as Array<{
    id: string;
    display_name: string;
    is_admin: boolean | null;
    bg_color: string | null;
    text_color: string | null;
  }>) {
    chatProfileMap[p.id] = {
      display_name: p.display_name,
      is_admin: !!p.is_admin,
      bg_color: p.bg_color,
      text_color: p.text_color,
    };
  }

  // Build ticker cards from user_tip_metrics view
  const tickerCards: TickerCard[] = (() => {
    const metricsMap: Record<string, any> = {};
    for (const mm of ((metricsRes as any)?.data ?? []) as any[]) {
      metricsMap[mm.user_id] = mm;
    }
    const pl = (players as any[]).filter((p) => metricsMap[p.id]);
    // Inject computed pct_* fields
    for (const p of pl) {
      const m = metricsMap[p.id];
      const ptsExact = Number(m.pts_exact ?? 0);
      const ptsP1 = Number(m.pts_p1 ?? 0);
      const ptsGrp = Number(m.pts_hcp_group ?? 0);
      const ptsPo = Number(m.pts_hcp_playoff ?? 0);
      const ptsCze = Number(m.pts_hcp_czech ?? 0);
      const tot = ptsExact + ptsP1 + ptsGrp + ptsPo + ptsCze;
      if (tot > 0) {
        m.pct_exact = (ptsExact / tot) * 100;
        m.pct_p1 = (ptsP1 / tot) * 100;
        m.pct_grp = (ptsGrp / tot) * 100;
        m.pct_po = (ptsPo / tot) * 100;
        m.pct_cze = (ptsCze / tot) * 100;
      }
    }
    function topN(key: string, n: number, asc: boolean) {
      return pl
        .filter((p) => metricsMap[p.id]?.[key] != null)
        .map((p) => ({ p, v: Number(metricsMap[p.id][key]) }))
        .sort((a, b) => (asc ? a.v - b.v : b.v - a.v))
        .slice(0, n);
    }
    function teamAvg(key: string): number | null {
      const vs = pl.map((p) => Number(metricsMap[p.id]?.[key] ?? NaN)).filter((v) => !isNaN(v));
      if (vs.length === 0) return null;
      return vs.reduce((a, b) => a + b, 0) / vs.length;
    }
    function randInt(lo: number, hi: number) { return Math.floor(Math.random() * (hi - lo + 1)) + lo; }
    function formatTopList(items: Array<{ p: any; v: number }>, valueFmt: (v: number) => string): string {
      const result: string[] = [];
      let i = 0;
      while (i < items.length) {
        let j = i + 1;
        while (j < items.length && items[j].v === items[i].v) j++;
        const groupSize = j - i;
        const rank = i + 1;
        const valStr = valueFmt(items[i].v);
        if (groupSize === 1) {
          result.push(`${rank}. ${items[i].p.display_name} (${valStr})`);
        } else {
          const names = items.slice(i, j).map((x) => x.p.display_name).join(" a ");
          const word = groupSize === 2 ? "oba" : "všichni";
          result.push(`T-${rank}. ${names} (${word} ${valStr})`);
        }
        i = j;
      }
      return result.join(", ");
    }
    const cards: TickerCard[] = [];
    // A1: avg_margin_error TOP 3
    {
      const t = topN("avg_margin_error", randInt(3, 6), true);
      if (t.length >= 2)
        cards.push({
          icon: "🔮",
          title: "Nejmenší chyba v náskoku",
          body: formatTopList(t, (v) => v.toFixed(2)),
        });
    }
    // A2: avg_goals_error TOP 3
    {
      const t = topN("avg_goals_error", randInt(3, 6), true);
      if (t.length >= 2)
        cards.push({
          icon: "🏒",
          title: "Nejmenší celková chyba ve skóre",
          body: formatTopList(t, (v) => v.toFixed(2)),
        });
    }
    // B1: exact_count TOP 3 (higher = better)
    {
      const t = topN("exact_count", randInt(3, 6), false);
      if (t.length >= 2 && t[0].v > 0)
        cards.push({
          icon: "✨",
          title: "Nejvíc přesných výsledků",
          body: formatTopList(t, (v) => `${v}×`),
        });
    }
    // B2: off_by_one_count TOP 3
    {
      const t = topN("off_by_one_count", randInt(3, 6), false);
      if (t.length >= 2 && t[0].v > 0)
        cards.push({
          icon: "😅",
          title: "„O jeden gól vedle\" mistři",
          body: formatTopList(t, (v) => `${v}×`),
        });
    }
    // C1: avg_hcp_distance TOP 2 + BOTTOM 2
    {
      const n_c1 = randInt(3, 6);
      const hi = topN("avg_hcp_distance", n_c1, false);
      const lo = topN("avg_hcp_distance", n_c1, true);
      if (hi.length >= 2 && lo.length >= 2 && hi[0].p.id !== lo[0].p.id)
        cards.push({
          icon: "🎯",
          title: "Vzdálenost od handicapové čáry",
          body: `daleko: ${hi.map((x) => `${x.p.display_name} (${x.v.toFixed(2)})`).join(", ")} • blízko: ${lo.map((x) => `${x.p.display_name} (${x.v.toFixed(2)})`).join(", ")}`,
        });
    }
    // C2: fav_pct TOP 2 + BOTTOM 2
    {
      const n_c2 = randInt(3, 6);
      const hi = topN("fav_pct", n_c2, false);
      const lo = topN("fav_pct", n_c2, true);
      if (hi.length >= 2 && lo.length >= 2 && hi[0].p.id !== lo[0].p.id)
        cards.push({
          icon: "💫",
          title: "Sázka na favority",
          body: `favoritáři: ${hi.map((x) => `${x.p.display_name} (${Math.round(x.v)}%)`).join(", ")} • underdogové: ${lo.map((x) => `${x.p.display_name} (${Math.round(x.v)}%)`).join(", ")}`,
        });
    }
    // D1-D5: composition pct
    const dCats: Array<{ key: string; icon: string; title: string }> = [
      { key: "pct_exact", icon: "💯", title: "Body z přesných výsledků" },
      { key: "pct_p1", icon: "🥅", title: "Body z 1. třetin" },
      { key: "pct_grp", icon: "🎲", title: "Body z handicapů skupiny" },
      { key: "pct_po", icon: "🏆", title: "Body z handicapů playoff" },
      { key: "pct_cze", icon: "🦁", title: "Body z českého handicapu" },
    ];
    for (const c of dCats) {
      const n_d = randInt(3, 6);
      const hi = topN(c.key, n_d, false);
      const lo = topN(c.key, n_d, true);
      const av = teamAvg(c.key);
      if (hi.length === 0 || lo.length === 0 || av === null) continue;
      if (hi[0].p.id === lo[0].p.id) continue;
      const hiStr = hi.map((x) => `${x.p.display_name} ${Math.round(x.v)}%`).join(", ");
      const loStr = lo.map((x) => `${x.p.display_name} ${Math.round(x.v)}%`).join(", ");
      cards.push({
        icon: c.icon,
        title: c.title,
        avgNote: `(průměr tipovačky: ${Math.round(av)}%)`,
        body: `nejvíc ${hiStr} • nejmíň ${loStr}`,
      });
    }
    // Shuffle
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    return cards;
  })();

  const chatSlot = user ? (
    <>
      <StatsTicker cards={tickerCards} />
      <Chat
      initialMessages={(chatMessagesRes?.data ?? []) as ChatMessage[]}
      profiles={chatProfileMap}
      currentUserId={myId}
      canPost={canChat}
      isAdmin={isAdmin}
    />
    </>
  ) : undefined;

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
      chatSlot={chatSlot}
    />
  );
}
