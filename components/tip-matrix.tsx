"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { STAGE_LABEL, type Match, type Pick, type Profile, type Team, type Score } from "@/lib/types";
import { ColorPickerModal } from "@/components/color-picker-modal";
import { notifyLateTip } from "@/lib/admin-notify";

interface PlayerWithTotal extends Profile {
  total?: number;
}

interface ActiveUser {
  id: string;
  display_name: string;
  last_seen_at: string | null;
}

interface PendingPick {
  user_id: string;
  match_id: number;
  home_score: number;
  away_score: number;
  home_score_p1: number | null;
  away_score_p1: number | null;
}

interface Props {
  // null = host (nepÅihlÃ¡Å¡enÃ½)
  myUserId: string | null;
  isAdmin?: boolean;
  matches: Match[];
  teams: Team[];
  players: PlayerWithTotal[];
  picks: Pick[];
  scores: Score[];
  activeUsers?: ActiveUser[];
  pendingPicks?: PendingPick[];
}

const HEADER_COLORS = [
  "bg-rose-600",
  "bg-orange-600",
  "bg-amber-600",
  "bg-yellow-600",
  "bg-lime-600",
  "bg-green-600",
  "bg-emerald-600",
  "bg-teal-600",
  "bg-cyan-600",
  "bg-sky-600",
  "bg-blue-600",
  "bg-indigo-600",
  "bg-violet-600",
  "bg-fuchsia-600",
  "bg-pink-600",
];

const HEADER_BORDERS = [
  "border-rose-600",
  "border-orange-600",
  "border-amber-600",
  "border-yellow-600",
  "border-lime-600",
  "border-green-600",
  "border-emerald-600",
  "border-teal-600",
  "border-cyan-600",
  "border-sky-600",
  "border-blue-600",
  "border-indigo-600",
  "border-violet-600",
  "border-fuchsia-600",
  "border-pink-600",
];

const HEADER_COLOR_HEX = [
  "#e11d48", // rose-600
  "#ea580c", // orange-600
  "#d97706", // amber-600
  "#ca8a04", // yellow-600
  "#65a30d", // lime-600
  "#16a34a", // green-600
  "#059669", // emerald-600
  "#0d9488", // teal-600
  "#0891b2", // cyan-600
  "#0284c7", // sky-600
  "#2563eb", // blue-600
  "#4f46e5", // indigo-600
  "#7c3aed", // violet-600
  "#c026d3", // fuchsia-600
  "#db2777", // pink-600
];

function userColorIdx(userId: string) {
  let h = 0;
  for (const c of userId) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h % HEADER_COLORS.length;
}
function colorForUser(userId: string) {
  return HEADER_COLORS[userColorIdx(userId)];
}
function borderForUser(userId: string) {
  return HEADER_BORDERS[userColorIdx(userId)];
}
function hexForUser(userId: string) {
  return HEADER_COLOR_HEX[userColorIdx(userId)];
}

// MapovÃ¡nÃ­ IIHF 3-pÃ­smennÃ½ch kÃ³dÅ¯ na ISO 3166-1 alpha-2 kÃ³dy (pro flagcdn.com)
const TEAM_ISO2: Record<string, string> = {
  CAN: "ca", USA: "us", FIN: "fi", SWE: "se", CZE: "cz",
  SUI: "ch", GER: "de", SVK: "sk", LAT: "lv", DEN: "dk",
  FRA: "fr", ITA: "it", AUT: "at", NOR: "no", KAZ: "kz",
  HUN: "hu", SLO: "si", POL: "pl", BLR: "by",
};

function flagUrl(code: string): string | null {
  const iso = TEAM_ISO2[code];
  return iso ? `https://flagcdn.com/w20/${iso}.png` : null;
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString("cs-CZ", {
    day: "numeric",
    month: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Prague",
  });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("cs-CZ", {
    day: "numeric",
    month: "numeric",
    timeZone: "Europe/Prague",
  });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString("cs-CZ", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Prague",
  });
}

function TeamCell({
  t,
  hcp,
  isHome,
}: {
  t: Team | undefined;
  hcp: number | null;
  isHome: boolean;
}) {
  if (!t) return <>?</>;
  const v = hcp == null ? null : isHome ? hcp : -hcp;
  const sign = v === null ? "" : v > 0 ? `+${v}` : `${v}`;
  const url = flagUrl(t.code);
  return (
    <>
      {/* MOBILE: flag (vertically centered) + stacked code/hcp on right */}
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap md:hidden">
        {url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={t.code}
            className="inline-block h-[16px] w-auto rounded-sm shadow-sm"
          />
        )}
        <span className="inline-flex flex-col leading-tight">
          <span>{t.code}</span>
          {v !== null && (
            <span className="text-[11px] text-neutral-500">{sign}</span>
          )}
        </span>
      </span>
      {/* DESKTOP: flag + full name + (hcp) inline */}
      <span className="hidden items-center gap-1.5 whitespace-nowrap md:inline-flex">
        {url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={t.code}
            className="inline-block h-[16px] w-auto rounded-sm shadow-sm"
          />
        )}
        <span>
          {t.name_cs}
          {v === null ? "" : ` (${sign})`}
        </span>
      </span>
    </>
  );
}

function hcpSideCode(
  pick: { home_score: number; away_score: number },
  match: Match,
): string | null {
  const hcp = match.home_handicap;
  const pickDiff = pick.home_score - pick.away_score;
  if (hcp == null) {
    // Bez handicapu â vrÃ¡tÃ­me predicted winner (na vlajku v tipu).
    if (pickDiff > 0) return match.home_code;
    if (pickDiff < 0) return match.away_code;
    return null;
  }
  // S handicapem: musÃ­ odpovÃ­dat SQL scoring (0002_scoring.sql) â pick_diff alone.
  if (pickDiff > 0) return match.home_code;
  if (pickDiff < 0) return match.away_code;
  return hcp >= 0 ? match.home_code : match.away_code;
}

function hcpSideValue(
  pick: { home_score: number; away_score: number },
  match: Match,
): string | null {
  const hcp = match.home_handicap;
  if (hcp == null) return null;
  const pickDiff = pick.home_score - pick.away_score;
  const sideHome =
    pickDiff > 0 || (pickDiff === 0 && hcp >= 0);
  const v = sideHome ? hcp : -hcp;
  return v > 0 ? `+${v}` : `${v}`;
}

// PomocnÃ¡: signovanÃ¡ hodnota handicapu (pro mobilnÃ­ ZÃ¡pas zobrazenÃ­).
function fmtHcp(v: number): string {
  return v > 0 ? `+${v}` : `${v}`;
}

export function TipMatrix({
  myUserId,
  isAdmin = false,
  matches,
  teams,
  players,
  picks,
  scores,
  activeUsers = [],
  pendingPicks = [],
}: Props) {
  const router = useRouter();
  const [editingTarget, setEditingTarget] = useState<
    { matchId: number; userId: string } | null
  >(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  // NaÄÃ­st oblÃ­benÃ© z localStorage pÅi mountu.
  useEffect(() => {
    try {
      const raw = localStorage.getItem("tipovacka:favorites");
      if (raw) setFavorites(new Set(JSON.parse(raw)));
    } catch {}
  }, []);
  function toggleFavorite(id: string) {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem(
          "tipovacka:favorites",
          JSON.stringify(Array.from(next)),
        );
      } catch {}
      return next;
    });
  }
  const [hidePast, setHidePast] = useState(false);
  const [pickingColorFor, setPickingColorFor] = useState<string | null>(null);
  // Team column width: mobile 80px, desktop 160px. Aktualizujeme pÅes resize listener.
  const [teamColWidth, setTeamColWidth] = useState(80);
  useEffect(() => {
    const update = () =>
      setTeamColWidth(typeof window !== "undefined" && window.innerWidth >= 768 ? 160 : 80);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  const me = players.find((p) => p.id === myUserId) ?? null;
  const colorTarget =
    pickingColorFor == null
      ? null
      : players.find((p) => p.id === pickingColorFor) ?? null;
  // Pro non-Master: filter view + email pref. Pro Master: hidePast.
  const [filterMode, setFilterMode] = useState<"all" | "near" | "future">("all");
  const [emailPref, setEmailPref] = useState(false);

  // NaÄÃ­st persistovanÃ© preference
  useEffect(() => {
    try {
      const fm = localStorage.getItem("tipovacka:filterMode");
      if (fm === "near" || fm === "future" || fm === "all") setFilterMode(fm);
      const ep = localStorage.getItem("tipovacka:emailPref");
      if (ep === "1") setEmailPref(true);
    } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem("tipovacka:filterMode", filterMode); } catch {}
  }, [filterMode]);
  useEffect(() => {
    try { localStorage.setItem("tipovacka:emailPref", emailPref ? "1" : "0"); } catch {}
  }, [emailPref]);

  // Heartbeat: kaÅ¾dÃ© 2 min poslat last_seen_at (jen kdyÅ¾ je tab v popÅedÃ­).
  // Skip pro hosta (myUserId == null).
  useEffect(() => {
    if (!myUserId) return;
    const sb = createClient();
    let cancelled = false;
    async function ping() {
      if (cancelled) return;
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      await sb
        .from("profiles")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("id", myUserId);
    }
    ping();
    const interval = setInterval(ping, 2 * 60 * 1000);
    const onVis = () => {
      if (document.visibilityState === "visible") ping();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [myUserId]);

  const teamMap = new Map(teams.map((t) => [t.code, t]));
  const k = (uid: string, mid: number) => `${uid}|${mid}`;
  const pickMap = new Map(picks.map((p) => [k(p.user_id, p.match_id), p]));
  const scoreMap = new Map(scores.map((s) => [k(s.user_id, s.match_id), s]));
  const pendingMap = new Map(
    pendingPicks.map((p) => [k(p.user_id, p.match_id), p]),
  );

  const editingMatch =
    editingTarget == null
      ? null
      : matches.find((m) => m.id === editingTarget.matchId) ?? null;
  const editingPlayer =
    editingTarget == null
      ? null
      : players.find((p) => p.id === editingTarget.userId) ?? null;
  const editingExisting =
    editingTarget == null
      ? null
      : pickMap.get(k(editingTarget.userId, editingTarget.matchId)) ?? null;

  // Thead sticky lehce pod menu (60 px) â menu bg-white pÅekrÃ½vÃ¡ vrchnÃ­ch ~7 px thead pÅes z-stacking, takÅ¾e Å¾Ã¡dnÃ½ gray gap.
  // Sticky thead pod fixed login barem (mobil 32 px) + menu (44 px) + AktivnÃ­ bar (64 px).
  // AktivnÃ­ bar mÃ¡ 20 px symbolickÃ½ gap dolÅ¯ (pb-5) â tipy âneprosvÃ­tajÃ­" pod thead.
  const headerBase = "sticky top-0 md:top-[124px] z-10 px-2 py-2 whitespace-nowrap text-white transform-gpu";

  const now = Date.now();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const todayStartMs = startOfDay.getTime();
  const oneDay = 24 * 60 * 60 * 1000;

  let visibleMatches = matches;
  if (isAdmin) {
    if (hidePast) {
      visibleMatches = matches.filter((m) => !m.finalized);
    }
  } else {
    if (filterMode === "near") {
      // dneÅ¡ek + 1 den dozadu + 1 den dopÅedu
      const minMs = todayStartMs - oneDay;
      const maxMs = todayStartMs + 2 * oneDay; // exclusive
      visibleMatches = matches.filter((m) => {
        const ms = new Date(m.starts_at).getTime();
        return ms >= minMs && ms < maxMs;
      });
    } else if (filterMode === "future") {
      // od zaÄÃ¡tku dneÅ¡nÃ­ho dne dÃ¡l
      visibleMatches = matches.filter(
        (m) => new Date(m.starts_at).getTime() >= todayStartMs,
      );
    }
  }

  return (
    <main>
      {/* Fixed AktivnÃ­ bar â drÅ¾Ã­ pod menu (44 px) na obou breakpointech.
          overflow-x-auto na user listu zajiÅ¡Å¥uje konstantnÃ­ vÃ½Å¡ku 36 px;
          isAdmin checkbox sedÃ­ v pevnÃ©m panelu napravo. */}
      <div className="fixed inset-x-0 top-[104px] md:top-[84px] z-[45] bg-white transform-gpu">
        <div className="mx-auto flex h-[40px] max-w-7xl items-center px-4">
          <div className="flex flex-1 items-center gap-2 overflow-x-auto whitespace-nowrap">
            <span className="text-xs text-neutral-500">
              AktivnÃ­ uÅ¾ivatelÃ©:
            </span>
            {(() => {
              // Self override: jÃ¡ vidÃ­m sÃ¡m sebe vÅ¾dy jako online (jsem na strÃ¡nce).
              const meEntry =
                me && !activeUsers.some((u) => u.id === myUserId)
                  ? [{ id: me.id, display_name: me.display_name, last_seen_at: null }]
                  : [];
              const list = [...meEntry, ...activeUsers];
              if (list.length === 0) {
                return <span className="text-xs text-neutral-400">nikdo</span>;
              }
              return list.map((u) => (
                <span
                  key={u.id}
                  className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800"
                  title={u.last_seen_at ?? ""}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                  {u.display_name}
                </span>
              ));
            })()}
          </div>
          {isAdmin && (
            <label className="flex flex-shrink-0 items-center gap-2 pl-2 text-xs text-neutral-600">
              <input
                type="checkbox"
                checked={hidePast}
                onChange={(e) => setHidePast(e.target.checked)}
              />
              SkrÃ½t odehranÃ©
            </label>
          )}
        </div>
      </div>
      <div className="h-[50px]" />
      <div className="-mx-4 h-[calc(100dvh-154px)] overflow-auto md:h-auto md:overflow-visible md:px-4">
        {/*
          FIXNÃ Å¡Ã­Åky sloupcÅ¯ â bez explicitnÃ­ Å¡Ã­Åky tabulky ji browser zmenÅ¡uje
          aby fitla do kontejneru, coÅ¾ rozbÃ­jÃ­ table-layout: fixed (pozorovÃ¡no).
          Team col je 80px mobile / 160px desktop (pÅes JS state, viz teamColWidth).
        */}
        <table
          className="text-xs border-separate border-spacing-0 table-fixed"
          style={{ width: 50 + (teamColWidth < 160 ? teamColWidth * 2 - 15 : teamColWidth * 2) + 75 + players.length * 77 }}
        >
          <colgroup>
            <col style={{ width: 50 }} />
            {/* ZÃ¡pas col â viditelnÃ½ jen na mobilu (=teamColWidth*2). Desktop mÃ¡ 0. */}
            <col style={{ width: teamColWidth < 160 ? teamColWidth * 2 - 15 : 0 }} />
            {/* DomÃ¡cÃ­/HostÃ© cols â viditelnÃ© jen na desktopu. Mobile mÃ¡ 0. */}
            <col style={{ width: teamColWidth < 160 ? 0 : teamColWidth }} />
            <col style={{ width: teamColWidth < 160 ? 0 : teamColWidth }} />
            <col style={{ width: 75 }} />
            {players.map((p) => (
              <col key={p.id} style={{ width: 77 }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th className={headerBase + " bg-neutral-900 text-center w-[50px] sticky left-0 md:left-auto z-40 md:z-10"}>Buly</th>
              {/* Mobile-only ZÃ¡pas (merged DomÃ¡cÃ­ + HostÃ©) */}
              <th className={headerBase + " md:invisible md:overflow-hidden bg-neutral-900 text-left w-[145px] sticky left-[50px] z-40"}>ZÃ¡pas</th>
              {/* Desktop-only DomÃ¡cÃ­/HostÃ© */}
              <th className={headerBase + " invisible overflow-hidden md:visible md:overflow-visible bg-neutral-900 text-left md:w-[160px]"}>DomÃ¡cÃ­</th>
              <th className={headerBase + " invisible overflow-hidden md:visible md:overflow-visible bg-neutral-900 text-left md:w-[160px]"}>HostÃ©</th>
              <th className={headerBase + " bg-neutral-900 text-center w-[75px] sticky left-[195px] md:left-auto z-40 md:z-10 border-r-[3px] border-r-double border-r-neutral-500 md:border-r-0"}>VÃ½sledek</th>
              {players.map((p) => {
                const isMineHeader = p.id === myUserId;
                const hasCustom = !!p.bg_color;
                const fallbackColor = colorForUser(p.id);
                // Pro isMine zvÃ½raznÃ­me sloupec pÅes inset box-shadow â neovlivÅuje Å¡Ã­Åku.
                const myAccentColor = hasCustom
                  ? p.bg_color ?? "#000"
                  : hexForUser(p.id); // deterministickÃ½ hex pro hrÃ¡Äe bez vlastnÃ­ch barev
                const inlineStyle: React.CSSProperties = { width: 77 };
                if (hasCustom) {
                  inlineStyle.backgroundColor = p.bg_color ?? undefined;
                  inlineStyle.color = p.text_color ?? undefined;
                }
                const isFavoriteHeader = !isAdmin && favorites.has(p.id);
                if (isMineHeader || isFavoriteHeader) {
                  // Linear-gradient mÃ­sto box-shadow: rendererÃ­ se na pixel-grid bez anti-aliasing artefaktÅ¯
                  inlineStyle.backgroundImage = `linear-gradient(to right, ${myAccentColor} 2px, transparent 2px, transparent calc(100% - 2px), ${myAccentColor} calc(100% - 2px))`;
                }
                return (
                  <th
                    key={p.id}
                    onClick={
                      isMineHeader
                        ? () => router.push("/profile")
                        : isAdmin
                          ? () => setPickingColorFor(p.id)
                          : myUserId
                            ? () => toggleFavorite(p.id)
                            : undefined
                    }
                    title={
                      isMineHeader
                        ? "Klikni pro Ãºpravu profilu (jmÃ©no, barvy, heslo)"
                        : isAdmin
                          ? `Uprav profil hrÃ¡Äe ${p.display_name}`
                          : isFavoriteHeader
                            ? `Odebrat ${p.display_name} z oblÃ­benÃ½ch`
                            : `PÅidat ${p.display_name} k oblÃ­benÃ½m`
                    }
                    className={
                      headerBase +
                      " text-center " +
                      (hasCustom ? "" : fallbackColor + " ") +
                      " cursor-pointer"
                    }
                    style={inlineStyle}
                  >
                    <div
                      className={
                        "font-semibold leading-tight overflow-hidden text-ellipsis " +
                        ((p.display_name?.length ?? 0) > 13
                          ? "text-[8px]"
                          : (p.display_name?.length ?? 0) > 11
                            ? "text-[9px]"
                            : (p.display_name?.length ?? 0) > 8
                              ? "text-[10px]"
                              : "text-xs")
                      }
                      title={p.display_name}
                    >
                      {p.display_name}
                    </div>
                    <div className="text-lg font-normal opacity-90 leading-none">
                      {p.total ?? 0}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visibleMatches.flatMap((m, idx) => {
              const home = teamMap.get(m.home_code);
              const away = teamMap.get(m.away_code);
              const startMs = new Date(m.starts_at).getTime();
              const lateMs = Date.now() - startMs;
              const started = lateMs >= 0;
              const inGrace = started && lateMs <= 10 * 60 * 1000;
              const result = m.finalized ? `${m.home_score}:${m.away_score}` : "-";
              const prev = idx > 0 ? visibleMatches[idx - 1] : null;
              const isNewDay =
                !!prev &&
                new Date(prev.starts_at).toDateString() !==
                  new Date(m.starts_at).toDateString();
              const colSpan = 4 + players.length;
              const rows: React.ReactNode[] = [];
              if (isNewDay) {
                rows.push(
                  <tr key={`gap-${m.id}`} aria-hidden="true">
                    <td colSpan={colSpan} className="h-1.5 bg-neutral-100 p-0" />
                  </tr>,
                );
              }
              // Striping ignoruje oddÄlenÃ­ dnÃ­ - natvrdo podle indexu zÃ¡pasu (idx).
              // CZE zÃ¡pas mÃ¡ vlastnÃ­ ÄervenÃ© pozadÃ­, jinak stÅÃ­dÃ¡nÃ­ bÃ­lÃ¡ / velmi svÄtlÃ¡ Å¾lutÃ¡.
              // Single solid bg per ÅÃ¡dek; alternace odstranÄna kvÅ¯li iter56 (vizuÃ¡lnÃ­ linky v highlightnutÃ½ch sloupcÃ­ch).
              const stripeBg = m.is_czech ? "bg-red-50" : "bg-white";
              const stageLabel = m.stage !== "group" ? STAGE_LABEL[m.stage] : null;
              rows.push(
                <tr
                  key={m.id}
                  className={stripeBg}
                  style={{ ["--cell-bg" as any]: m.is_czech ? "#fef2f2" : "#ffffff" }}
                >
                  <td className={"px-2 py-2 whitespace-nowrap text-center text-neutral-600 w-[50px] sticky left-0 md:static z-30 md:z-auto " + stripeBg}>
                    <div className="leading-tight">{fmtDate(m.starts_at)}</div>
                    <div className="text-[11px] text-neutral-500 leading-tight">{fmtTime(m.starts_at)}</div>
                    {stageLabel && (
                      <div className="mt-0.5 inline-block rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-800">
                        {stageLabel}
                      </div>
                    )}
                  </td>
                  {/* Mobile-only ZÃ¡pas (merged DomÃ¡cÃ­ + HostÃ©) */}
                  <td className={"md:invisible md:overflow-hidden px-2 py-2 whitespace-nowrap font-medium w-[145px] sticky left-[50px] z-30 " + stripeBg}>
                    <div className="flex flex-col gap-y-1 leading-tight text-xs">
                      <div className="flex items-center gap-1.5">
                        {home && (() => {
                          const url = flagUrl(home.code);
                          return url ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img src={url} alt={home.code} className="inline-block h-[14px] w-auto rounded-sm shadow-sm" />
                          ) : null;
                        })()}
                        <span className="font-medium">{home?.code ?? "?"}</span>
                        {m.home_handicap != null && (
                          <span className="text-[11px] text-neutral-500">{fmtHcp(m.home_handicap)}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {away && (() => {
                          const url = flagUrl(away.code);
                          return url ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img src={url} alt={away.code} className="inline-block h-[14px] w-auto rounded-sm shadow-sm" />
                          ) : null;
                        })()}
                        <span className="font-medium">{away?.code ?? "?"}</span>
                        {m.home_handicap != null && (
                          <span className="text-[11px] text-neutral-500">{fmtHcp(-m.home_handicap)}</span>
                        )}
                      </div>
                    </div>
                  </td>
                  {/* Desktop-only DomÃ¡cÃ­ */}
                  <td className={"invisible overflow-hidden md:visible md:overflow-visible px-2 py-2 whitespace-nowrap font-medium md:w-[160px] " + stripeBg}>
                    <TeamCell t={home} hcp={m.home_handicap} isHome />
                  </td>
                  {/* Desktop-only HostÃ© */}
                  <td className={"invisible overflow-hidden md:visible md:overflow-visible px-2 py-2 whitespace-nowrap font-medium md:w-[160px] " + stripeBg}>
                    <TeamCell t={away} hcp={m.home_handicap} isHome={false} />
                  </td>
                  <td className={"px-2 py-2 text-center w-[75px] h-px sticky left-[195px] md:static z-30 md:z-auto border-r-[3px] border-r-double border-r-neutral-300 md:border-r-0 " + stripeBg}>
                    {m.finalized ? (
                      <div className="relative h-full">
                        {/* VÃ½sledek po 60 min â vertikÃ¡lnÄ centrovanÃ½ v gapu mezi tip row 1 a row 2 */}
                        <div
                          className="absolute left-0 right-0 text-center text-lg font-semibold"
                          style={{ top: "9px", lineHeight: "22px" }}
                        >
                          {result}
                        </div>
                        {/* VÃ½sledek po 1. tÅetinÄ â bottom zarovnanÃ½ s tip row 3 bottom; stejnÃ¡ velikost jako result */}
                        <div
                          className="absolute left-0 right-0 bottom-0 text-center text-sm text-neutral-400"
                          style={{ lineHeight: "18px" }}
                        >
                          {m.home_score_p1 != null ? `(${m.home_score_p1}:${m.away_score_p1})` : ""}
                        </div>
                      </div>
                    ) : (
                      <div className="flex h-full items-center justify-center text-base font-semibold leading-tight text-neutral-400">
                        {result}
                      </div>
                    )}
                  </td>

                  {players.map((p) => {
                    const pick = pickMap.get(k(p.id, m.id));
                    const pendingPick = pendingMap.get(k(p.id, m.id));
                    const score = scoreMap.get(k(p.id, m.id));
                    const isMine = p.id === myUserId;
                    const visible = isMine || started || isAdmin;
                    const ownClickable = isMine && (!started || inGrace);
                    const adminClickable = isAdmin && !m.finalized;
                    const clickable = ownClickable || adminClickable;

                    let content: React.ReactNode;
                    if (!visible) {
                      content = <span className="text-neutral-400">ð</span>;
                    } else if (pick) {
                      const sideCode = hcpSideCode(pick, m);
                      const sideFlag = sideCode ? flagUrl(sideCode) : null;
                      const sideHcp = hcpSideValue(pick, m);
                      content = m.finalized ? (
                        // VyhodnocenÃ½ tip â 3 ÅÃ¡dky: fulltime tip / vlajka (grayscale kdyÅ¾ HCP Å¡patnÄ) / 1. tÅetina tip
                        <div className="flex flex-col gap-y-1 leading-tight">
                          <div className="text-center text-sm font-medium">
                            <span
                              className={
                                score
                                  ? score.exact_points > 0
                                    ? "text-fuchsia-600 font-bold"
                                    : "text-[#595959]"
                                  : ""
                              }
                            >
                              {pick.home_score}:{pick.away_score}
                            </span>
                          </div>
                          <div className="flex items-center justify-center gap-1 text-xs">
                            {sideFlag && (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img
                                src={sideFlag}
                                alt={sideCode ?? ""}
                                className={
                                  "h-[17px] w-auto rounded-sm shadow-sm" +
                                  (score && score.hcp_points <= 0 ? " grayscale opacity-50" : "")
                                }
                              />
                            )}
                          </div>
                          <div className="text-center text-xs">
                            {pick.home_score_p1 != null ? (
                              <span
                                className={
                                  score && score.p1_points > 0
                                    ? "text-fuchsia-400"
                                    : "text-neutral-400"
                                }
                              >
                                ({pick.home_score_p1}:{pick.away_score_p1})
                              </span>
                            ) : null}
                          </div>
                        </div>
                      ) : (
                        // NevyhodnocenÃ½ tip â kompaktnÃ­ layout: 60(20) / vlajka / CODE+hcp
                        <div className="flex flex-col gap-y-1 leading-tight">
                          <div className="text-center text-sm font-medium">
                            {pick.home_score}:{pick.away_score}
                            {pick.home_score_p1 != null && (
                              <span className="ml-1 text-neutral-500">
                                ({pick.home_score_p1}:{pick.away_score_p1})
                              </span>
                            )}
                          </div>
                          <div className="flex items-center justify-center text-xs">
                            {sideFlag && (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img
                                src={sideFlag}
                                alt={sideCode ?? ""}
                                className="h-[17px] w-auto rounded-sm shadow-sm"
                              />
                            )}
                          </div>
                          <div className="text-center text-xs text-neutral-500">
                            {sideCode && sideHcp != null
                              ? sideCode.toUpperCase() + sideHcp
                              : ""}
                          </div>
                        </div>
                      );
                    } else if (pendingPick) {
                      // tip ÄekÃ¡ na schvÃ¡lenÃ­ Masterem
                      const sideCode = hcpSideCode(pendingPick, m);
                      const sideFlag = sideCode ? flagUrl(sideCode) : null;
                      const sideHcp = hcpSideValue(pendingPick, m);
                      content = (
                        <div title="Tip ÄekÃ¡ na schvÃ¡lenÃ­ Kubou" className="flex flex-col gap-y-1 leading-tight text-rose-600">
                          <div className="text-center text-sm font-medium">
                            <span className="mr-0.5">?</span>
                            {pendingPick.home_score}:{pendingPick.away_score}
                            {pendingPick.home_score_p1 != null && (
                              <span className="ml-1 text-rose-400">
                                ({pendingPick.home_score_p1}:{pendingPick.away_score_p1})
                              </span>
                            )}
                          </div>
                          <div className="flex items-center justify-center text-xs opacity-70">
                            {sideFlag && (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img
                                src={sideFlag}
                                alt={sideCode ?? ""}
                                className="h-[17px] w-auto rounded-sm shadow-sm"
                              />
                            )}
                          </div>
                          <div className="text-center text-xs opacity-70">
                            {sideCode && sideHcp != null
                              ? sideCode.toUpperCase() + sideHcp
                              : ""}
                          </div>
                        </div>
                      );
                    } else if (isMine && started && !inGrace && !isAdmin) {
                      // hrÃ¡Ä nestihl tip - promeÅ¡kal Äas startu (i 10min grace)
                      content = (
                        <span title="Nestihl jsi tip" className="text-base">ð</span>
                      );
                    } else {
                      // chybÄjÃ­cÃ­ tip: klikatelnÃ¡ buÅka = tuÄnÃ© "+" (vyzÃ½vÃ¡ k tipu), nekl. = pomlÄka
                      content = (
                        <span className={clickable ? "text-neutral-500 text-lg font-bold leading-none" : "text-neutral-400"}>
                          {clickable ? "+" : "-"}
                        </span>
                      );
                    }

                    const cellBg = adminClickable && !ownClickable && !m.is_czech
                      ? "bg-amber-50/30 "
                      : "";
                    const cellHover = clickable
                      ? m.is_czech
                        ? "cursor-pointer hover:bg-red-200 "
                        : "cursor-pointer hover:bg-amber-100 "
                      : "";
                    const hasCustomCell = !!p.bg_color;
                    const myAccentColor = hasCustomCell
                      ? p.bg_color ?? "#000"
                      : hexForUser(p.id);
                    const cellStyle: React.CSSProperties = { width: 77 };
                    const isFavoriteCell = !isAdmin && favorites.has(p.id);
                    if (isMine || isFavoriteCell) {
                      cellStyle.backgroundImage = `linear-gradient(to right, ${myAccentColor} 2px, transparent 2px, transparent calc(100% - 2px), ${myAccentColor} calc(100% - 2px))`;
                    }

                    return (
                      <td
                        key={p.id}
                        onClick={
                          clickable
                            ? () =>
                                setEditingTarget({
                                  matchId: m.id,
                                  userId: p.id,
                                })
                            : undefined
                        }
                        style={cellStyle}
                        className={
                          "px-1 py-2 text-center overflow-hidden " + cellBg + cellHover
                        }
                      >
                        {content}
                      </td>
                    );
                  })}
                </tr>,
              );
              return rows;
            })}
          </tbody>
        </table>
      </div>

      {editingMatch && editingPlayer && (
        <TipModal
          match={editingMatch}
          targetUser={editingPlayer}
          asAdmin={isAdmin && editingPlayer.id !== myUserId}
          existing={editingExisting}
          teamMap={teamMap}
          onClose={() => setEditingTarget(null)}
          onSaved={() => {
            setEditingTarget(null);
            location.reload();
          }}
        />
      )}

      {colorTarget && (
        <ColorPickerModal
          userId={colorTarget.id}
          displayName={colorTarget.display_name}
          initialBg={colorTarget.bg_color ?? hexForUser(colorTarget.id)}
          initialText={colorTarget.text_color ?? "#ffffff"}
          canEditName={isAdmin || colorTarget.id === myUserId}
          onClose={() => setPickingColorFor(null)}
          onSaved={() => {
            setPickingColorFor(null);
            location.reload();
          }}
        />
      )}
    </main>
  );
}

function TipModal({
  match,
  targetUser,
  asAdmin,
  existing,
  teamMap,
  onClose,
  onSaved,
}: {
  match: Match;
  targetUser: Profile;
  asAdmin: boolean;
  existing: Pick | null;
  teamMap: Map<string, Team>;
  onClose: () => void;
  onSaved: () => void;
}) {
  // Pokud existuje tip, pÅedvyplnit. Jinak prÃ¡zdnÃ© (mobile UX).
  const [hs, setHs] = useState<string>(
    existing?.home_score != null ? String(existing.home_score) : "",
  );
  const [as_, setAs] = useState<string>(
    existing?.away_score != null ? String(existing.away_score) : "",
  );
  const [h1, setH1] = useState<string>(
    existing?.home_score_p1 != null ? String(existing.home_score_p1) : "",
  );
  const [a1, setA1] = useState<string>(
    existing?.away_score_p1 != null ? String(existing.away_score_p1) : "",
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  // Refs pro sekvenÄnÃ­ zadÃ¡vÃ¡nÃ­ skÃ³re na mobilu (auto-advance po kaÅ¾dÃ© ÄÃ­slici)
  const hsRef = useRef<HTMLInputElement>(null);
  const asRef = useRef<HTMLInputElement>(null);
  const h1Ref = useRef<HTMLInputElement>(null);
  const a1Ref = useRef<HTMLInputElement>(null);
  const saveBtnRef = useRef<HTMLButtonElement>(null);

  function handleDigit(
    val: string,
    setter: (v: string) => void,
    nextRef: React.RefObject<HTMLElement | null>,
  ) {
    const d = val.replace(/\D/g, "").slice(0, 1);
    setter(d);
    if (d.length === 1 && nextRef.current) {
      nextRef.current.focus({ preventScroll: true });
    }
  }

  const home = teamMap.get(match.home_code);
  const away = teamMap.get(match.away_code);

  async function save() {
    if (hs === "" || as_ === "") {
      setErr("VyplÅ skÃ³re po 60 minutÃ¡ch.");
      return;
    }
    if (h1 === "" || a1 === "") {
      setErr("VyplÅ skÃ³re po 1. tÅetinÄ.");
      return;
    }
    const hsN = Number(hs);
    const asN = Number(as_);
    const h1N = Number(h1);
    const a1N = Number(a1);
    if (h1N > hsN || a1N > asN) {
      setErr("SkÃ³re po 1. tÅetinÄ nemÅ¯Å¾e bÃ½t vyÅ¡Å¡Ã­ neÅ¾ finÃ¡lnÃ­ skÃ³re.");
      return;
    }
    setSaving(true);
    setErr("");
    const sb = createClient();
    const payload = {
      user_id: targetUser.id,
      match_id: match.id,
      home_score: Number(hs),
      away_score: Number(as_),
      home_score_p1: Number(h1),
      away_score_p1: Number(a1),
    };

    const startMs = new Date(match.starts_at).getTime();
    const lateMs = Date.now() - startMs;
    const isLate = !asAdmin && lateMs > 0 && lateMs <= 10 * 60 * 1000;

    if (isLate) {
      const { error } = await sb.from("pending_picks").insert(payload);
      setSaving(false);
      if (error) {
        setErr(error.message);
      } else {
        // Fire-and-forget notifikace adminovi (selÅ¾e-li, neblokuje UX)
        notifyLateTip(targetUser.display_name, match.id).catch(() => {});
        alert("ZÃ¡pas uÅ¾ zaÄal. TvÅ¯j tip jsme uloÅ¾ili a ÄekÃ¡ na schvÃ¡lenÃ­ Kubou.");
        onSaved();
      }
      return;
    }

    const { error } = await sb.from("picks").upsert(payload);
    setSaving(false);
    if (error) setErr(error.message);
    else onSaved();
  }

  async function deletePick() {
    if (!existing) return;
    if (!confirm(`Smazat tip hrÃ¡Äe ${targetUser.display_name}?`)) return;
    setSaving(true);
    setErr("");
    const sb = createClient();
    const { error } = await sb
      .from("picks")
      .delete()
      .eq("user_id", targetUser.id)
      .eq("match_id", match.id);
    setSaving(false);
    if (error) setErr(error.message);
    else onSaved();
  }

  const homeFlag = flagUrl(match.home_code);
  const awayFlag = flagUrl(match.away_code);

  // Portal: render modal jako pÅÃ­mÃ© dÃ­tÄ <body> aby se obeÅ¡el jakÃ½koli ancestor
  // s transform/filter/contain (vytvÃ¡ÅejÃ­cÃ­ containing block pro position:fixed
  // â zpÅ¯sobovalo right-aligned modal na mobilu).
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  // visualViewport-anchored modal centering — fixes iOS Safari right-alignment when
  // viewport meta initial-scale<1 makes layout viewport wider than visual viewport.
  const [vvCenter, setVvCenter] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () => {
      const vv = window.visualViewport;
      if (vv) {
        setVvCenter({
          x: vv.offsetLeft + vv.width / 2,
          y: vv.offsetTop + vv.height / 2,
          w: vv.width,
          h: vv.height,
        });
      } else {
        setVvCenter({
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
          w: window.innerWidth,
          h: window.innerHeight,
        });
      }
    };
    update();
    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener("resize", update);
      vv.addEventListener("scroll", update);
      return () => {
        vv.removeEventListener("resize", update);
        vv.removeEventListener("scroll", update);
      };
    }
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  if (!mounted) return null;

  return createPortal(
    (
    <>
    <div
      className="fixed inset-0 z-40 bg-black/40"
      onClick={onClose}
    />
    <div
      className="fixed z-50 rounded-lg bg-white p-6 shadow-xl"
      style={
        vvCenter
          ? {
              left: vvCenter.x + "px",
              top: vvCenter.y + "px",
              transform: "translate(-50%, -50%)",
              width: Math.min(vvCenter.w - 32, 448) + "px",
              maxHeight: vvCenter.h - 32 + "px",
              overflowY: "auto",
            }
          : {
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              width: "calc(100vw - 2rem)",
              maxWidth: "28rem",
            }
      }
      onClick={(e) => e.stopPropagation()}
    >
        <div className="text-center">
          {asAdmin && (
            <p className="text-sm font-semibold text-neutral-700">
              {targetUser.display_name}
            </p>
          )}
          {/* Row 1: datum + Äas */}
          <p className="text-sm text-neutral-600">
            {new Date(match.starts_at).toLocaleString("cs-CZ", {
              weekday: "short",
              day: "numeric",
              month: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "Europe/Prague",
            })}
          </p>
          {/* Row 2: tÃ½m vs tÃ½m s vlajeÄkami z obou stran (full names i na mobilu) */}
          {/* Row 2: tÃ½m vs tÃ½m. Vlajky v pÅ¯vodnÃ­ch proporcÃ­ch (h-[20px] w-auto).
              Handicapy jsou absolute-positioned POD kaÅ¾dou vlajkou, vycentrovanÃ© na stÅed
              vlajky (left-1/2 -translate-x-1/2). NezasahujÃ­ do flex layoutu â h2 zÅ¯stÃ¡vÃ¡
              stejnÄ Å¡irokÃ½ jako bez handicapu. mb-5 pÅidÃ¡ mÃ­sto pro overflow handicap textu. */}
          <h2
            className={
              "mt-2 inline-flex items-center justify-center gap-2 text-lg font-semibold " +
              (match.home_handicap != null ? "mb-5" : "")
            }
          >
            <span className="relative">
              {homeFlag && (
                <img
                  src={homeFlag}
                  alt={match.home_code}
                  className="h-[20px] w-auto rounded-sm shadow-sm"
                />
              )}
              {match.home_handicap != null && (
                <span className="absolute left-1/2 top-full mt-0.5 -translate-x-1/2 whitespace-nowrap text-xs font-normal text-neutral-500">
                  {match.home_code}{match.home_handicap > 0 ? "+" : ""}{match.home_handicap}
                </span>
              )}
            </span>
            <span>{home?.name_cs ?? match.home_code}</span>
            <span className="text-neutral-400">vs</span>
            <span>{away?.name_cs ?? match.away_code}</span>
            <span className="relative">
              {awayFlag && (
                <img
                  src={awayFlag}
                  alt={match.away_code}
                  className="h-[20px] w-auto rounded-sm shadow-sm"
                />
              )}
              {match.home_handicap != null && (
                <span className="absolute left-1/2 top-full mt-0.5 -translate-x-1/2 whitespace-nowrap text-xs font-normal text-neutral-500">
                  {match.away_code}{-match.home_handicap > 0 ? "+" : ""}{-match.home_handicap}
                </span>
              )}
            </span>
          </h2>
        </div>

        <div className="mt-6 space-y-5">
          <div className="text-center">
            <label className="text-xs uppercase tracking-wide text-neutral-500">
              SkÃ³re po 60 minutÃ¡ch
            </label>
            <div className="mt-1 flex items-center justify-center gap-3">
              <input
                ref={hsRef}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={1}
                autoComplete="off"
                data-1p-ignore="true"
                data-lpignore="true"
                value={hs}
                onChange={(e) => handleDigit(e.target.value, setHs, asRef)}
                onFocus={(e) => e.currentTarget.select()}
                className="h-[60px] w-[60px] rounded border px-2 text-center text-xl"
                placeholder=""
                autoFocus
              />
              <span className="text-xl">:</span>
              <input
                ref={asRef}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={1}
                autoComplete="off"
                data-1p-ignore="true"
                data-lpignore="true"
                value={as_}
                onChange={(e) => handleDigit(e.target.value, setAs, h1Ref)}
                onFocus={(e) => e.currentTarget.select()}
                className="h-[60px] w-[60px] rounded border px-2 text-center text-xl"
                placeholder=""
              />
            </div>
          </div>

          <div className="text-center">
            <label className="text-xs uppercase tracking-wide text-neutral-500">
              SkÃ³re po 1. tÅetinÄ
            </label>
            <div className="mt-1 flex items-center justify-center gap-3">
              <input
                ref={h1Ref}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={1}
                autoComplete="off"
                data-1p-ignore="true"
                data-lpignore="true"
                value={h1}
                onChange={(e) => handleDigit(e.target.value, setH1, a1Ref)}
                onFocus={(e) => e.currentTarget.select()}
                className="h-[60px] w-[60px] rounded border px-2 text-center text-xl"
                placeholder=""
              />
              <span className="text-xl">:</span>
              <input
                ref={a1Ref}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={1}
                autoComplete="off"
                data-1p-ignore="true"
                data-lpignore="true"
                value={a1}
                onChange={(e) => handleDigit(e.target.value, setA1, saveBtnRef)}
                onFocus={(e) => e.currentTarget.select()}
                className="h-[60px] w-[60px] rounded border px-2 text-center text-xl"
                placeholder=""
              />
            </div>
          </div>
        </div>

        {err && <p className="mt-3 text-sm text-rose-600 text-center">{err}</p>}

        <div className="mt-6 flex justify-between gap-2">
          <div>
            {asAdmin && existing && (
              <button
                type="button"
                onClick={deletePick}
                disabled={saving}
                className="rounded border border-rose-300 px-3 py-2 text-sm text-rose-700 hover:bg-rose-50 disabled:opacity-50"
              >
                Smazat tip
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded border px-4 py-2 text-sm hover:bg-neutral-50"
            >
              ZruÅ¡it
            </button>
            <button
              ref={saveBtnRef}
              type="button"
              onClick={save}
              disabled={saving}
              className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {saving ? "UklÃ¡dÃ¡mâ¦" : "UloÅ¾it tip"}
            </button>
          </div>
        </div>
    </div>
    </>
    ),
    document.body,
  );
}
