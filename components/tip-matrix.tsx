"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { STAGE_LABEL, type Match, type Pick, type Profile, type Team, type Score } from "@/lib/types";
import { ColorPickerModal } from "@/components/color-picker-modal";

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
  // null = host (nepřihlášený)
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

// Mapování IIHF 3-písmenných kódů na ISO 3166-1 alpha-2 kódy (pro flagcdn.com)
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
            className="inline-block h-[15px] w-auto rounded-sm shadow-sm"
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
            className="inline-block h-[15px] w-auto rounded-sm shadow-sm"
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
  if (hcp == null) return null;
  // Strana, která vyhrává handicapový tip podle pick + handicapu domácích.
  // Handicap je vždy půlový, takže adjusted není nikdy 0.
  const adjusted = pick.home_score - pick.away_score + hcp;
  return adjusted > 0 ? match.home_code : match.away_code;
}

function hcpSideValue(
  pick: { home_score: number; away_score: number },
  match: Match,
): string | null {
  const hcp = match.home_handicap;
  if (hcp == null) return null;
  const adjusted = pick.home_score - pick.away_score + hcp;
  const sideHome = adjusted > 0;
  const v = sideHome ? hcp : -hcp;
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
  const [hidePast, setHidePast] = useState(false);
  const [pickingColorFor, setPickingColorFor] = useState<string | null>(null);
  // Team column width: mobile 80px, desktop 160px. Aktualizujeme přes resize listener.
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

  // Načíst persistované preference
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

  // Heartbeat: každé 2 min poslat last_seen_at (jen když je tab v popředí).
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

  // Thead sticky lehce pod menu (60 px) — menu bg-white překrývá vrchních ~7 px thead přes z-stacking, takže žádný gray gap.
  const headerBase = "sticky top-[64px] md:top-[67px] z-10 px-2 py-2 whitespace-nowrap text-white";

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
      // dnešek + 1 den dozadu + 1 den dopředu
      const minMs = todayStartMs - oneDay;
      const maxMs = todayStartMs + 2 * oneDay; // exclusive
      visibleMatches = matches.filter((m) => {
        const ms = new Date(m.starts_at).getTime();
        return ms >= minMs && ms < maxMs;
      });
    } else if (filterMode === "future") {
      // od začátku dnešního dne dál
      visibleMatches = matches.filter(
        (m) => new Date(m.starts_at).getTime() >= todayStartMs,
      );
    }
  }

  return (
    <main>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-xs text-neutral-500">
          Aktivní uživatelé:
        </span>
        {(() => {
          // Self override: já vidím sám sebe vždy jako online (jsem na stránce).
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
        {isAdmin ? (
          <label className="ml-auto flex items-center gap-2 text-xs text-neutral-600">
            <input
              type="checkbox"
              checked={hidePast}
              onChange={(e) => setHidePast(e.target.checked)}
            />
            Skrýt odehrané zápasy
          </label>
        ) : (
          <div className="ml-auto flex flex-wrap items-center gap-3 text-xs text-neutral-600">
            <label className="flex items-center gap-1">
              Zobrazit:
              <select
                value={filterMode}
                onChange={(e) => setFilterMode(e.target.value as "all" | "near" | "future")}
                className="rounded border px-2 py-1"
              >
                <option value="all">Všechny zápasy</option>
                <option value="near">Nejbližší dny</option>
                <option value="future">Pohled vpřed</option>
              </select>
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={emailPref}
                onChange={(e) => setEmailPref(e.target.checked)}
              />
              <span className="rounded bg-rose-100 px-1.5 py-0.5 text-rose-800">
                Email upozornění (30 min před začátkem) - zatím nefunkční
              </span>
            </label>
          </div>
        )}
      </div>
      <div className="-mx-4 px-4">
        {/*
          FIXNÍ šířky sloupců — bez explicitní šířky tabulky ji browser zmenšuje
          aby fitla do kontejneru, což rozbíjí table-layout: fixed (pozorováno).
          Team col je 80px mobile / 160px desktop (přes JS state, viz teamColWidth).
        */}
        <table
          className="text-xs border-separate border-spacing-0 table-fixed"
          style={{ width: 50 + teamColWidth * 2 + 75 + players.length * 77 }}
        >
          <colgroup>
            <col style={{ width: 50 }} />
            <col style={{ width: teamColWidth }} />
            <col style={{ width: teamColWidth }} />
            <col style={{ width: 75 }} />
            {players.map((p) => (
              <col key={p.id} style={{ width: 77 }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th className={headerBase + " bg-neutral-900 text-center w-[50px] sticky left-0 md:left-auto z-40 md:z-10"}>Buly</th>
              <th className={headerBase + " bg-neutral-900 text-left w-[80px] md:w-[160px] sticky left-[50px] md:left-auto z-40 md:z-10"}>Domácí</th>
              <th className={headerBase + " bg-neutral-900 text-left w-[80px] md:w-[160px] sticky left-[130px] md:left-auto z-40 md:z-10"}>Hosté</th>
              <th className={headerBase + " bg-neutral-900 text-center w-[75px] sticky left-[210px] md:left-auto z-40 md:z-10"}>Výsledek</th>
              {players.map((p) => {
                const isMineHeader = p.id === myUserId;
                const hasCustom = !!p.bg_color;
                const fallbackColor = colorForUser(p.id);
                // Pro isMine zvýrazníme sloupec přes inset box-shadow — neovlivňuje šířku.
                const myAccentColor = hasCustom
                  ? p.bg_color ?? "#000"
                  : "#16a34a"; // emerald-600 jako fallback pro vlastníka
                const inlineStyle: React.CSSProperties = { width: 77 };
                if (hasCustom) {
                  inlineStyle.backgroundColor = p.bg_color ?? undefined;
                  inlineStyle.color = p.text_color ?? undefined;
                }
                if (isMineHeader) {
                  inlineStyle.boxShadow = `inset 2px 0 0 ${myAccentColor}, inset -2px 0 0 ${myAccentColor}`;
                }
                return (
                  <th
                    key={p.id}
                    onClick={
                      isMineHeader
                        ? () => router.push("/profile")
                        : isAdmin
                          ? () => setPickingColorFor(p.id)
                          : undefined
                    }
                    title={
                      isMineHeader
                        ? "Klikni pro úpravu profilu (jméno, barvy, heslo)"
                        : isAdmin
                          ? `Uprav profil hráče ${p.display_name}`
                          : undefined
                    }
                    className={
                      headerBase +
                      " text-center " +
                      (hasCustom ? "" : fallbackColor + " ") +
                      (isMineHeader || isAdmin ? " cursor-pointer" : "")
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
              // Striping ignoruje oddělení dní - natvrdo podle indexu zápasu (idx).
              // CZE zápas má vlastní červené pozadí, jinak střídání bílá / velmi světlá žlutá.
              const stripeBg = m.is_czech
                ? "bg-red-50 hover:bg-red-100"
                : idx % 2 === 0
                  ? "bg-neutral-50 hover:bg-neutral-100"
                  : "bg-[#fffef2] hover:bg-yellow-100";
              const stageLabel = m.stage !== "group" ? STAGE_LABEL[m.stage] : null;
              rows.push(
                <tr
                  key={m.id}
                  className={"border-b " + stripeBg}
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
                  <td className={"px-2 py-2 whitespace-nowrap font-medium w-[80px] md:w-[160px] sticky left-[50px] md:static z-30 md:z-auto " + stripeBg}>
                    <TeamCell t={home} hcp={m.home_handicap} isHome />
                  </td>
                  <td className={"px-2 py-2 whitespace-nowrap font-medium w-[80px] md:w-[160px] sticky left-[130px] md:static z-30 md:z-auto " + stripeBg}>
                    <TeamCell t={away} hcp={m.home_handicap} isHome={false} />
                  </td>
                  <td className={"text-center whitespace-nowrap w-[75px] h-px sticky left-[210px] md:static z-30 md:z-auto " + stripeBg}>
                    <div className="flex h-full flex-col">
                      <div className="flex flex-1 items-center justify-center px-2 pt-2 text-base font-semibold leading-tight">{result}</div>
                      <div className="flex flex-1 items-center justify-center px-2 pb-2 text-[11px] text-neutral-400 leading-tight">
                        {m.finalized && m.home_score_p1 != null ? `(${m.home_score_p1}:${m.away_score_p1})` : ""}
                      </div>
                    </div>
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
                      content = <span className="text-neutral-400">🔒</span>;
                    } else if (pick) {
                      const sideCode = hcpSideCode(pick, m);
                      const sideFlag = sideCode ? flagUrl(sideCode) : null;
                      const sideHcp = hcpSideValue(pick, m);
                      content = (
                        <div className="leading-tight">
                          {/* Row 1: fulltime (60m) */}
                          <div className="text-center font-medium">
                            <span
                              className={
                                score && score.exact_points > 0
                                  ? "text-fuchsia-600 font-bold"
                                  : ""
                              }
                            >
                              {pick.home_score}:{pick.away_score}
                            </span>
                          </div>
                          {/* Row 2: 1. třetina */}
                          <div className="text-center text-[11px]">
                            {pick.home_score_p1 != null ? (
                              <span
                                className={
                                  score && score.p1_points > 0
                                    ? "text-fuchsia-400"
                                    : "text-neutral-500"
                                }
                              >
                                ({pick.home_score_p1}:{pick.away_score_p1})
                              </span>
                            ) : null}
                          </div>
                          {/* Row 3: vlajka + (HCP value | ✓/✗ pokud vyhodnoceno) */}
                          <div className="flex items-center gap-1 text-[11px]">
                            {sideFlag && (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img
                                src={sideFlag}
                                alt={sideCode ?? ""}
                                className="h-[10px] w-auto rounded-sm shadow-sm"
                              />
                            )}
                            {score ? (
                              <span
                                className={
                                  "font-semibold " +
                                  (score.hcp_points > 0
                                    ? "text-emerald-600"
                                    : "text-rose-600")
                                }
                              >
                                {score.hcp_points > 0 ? "✓" : "✗"}
                              </span>
                            ) : (
                              sideHcp != null && (
                                <span className="text-neutral-500">{sideHcp}</span>
                              )
                            )}
                          </div>
                        </div>
                      );
                    } else if (pendingPick) {
                      // tip čeká na schválení Masterem
                      const sideCode = hcpSideCode(pendingPick, m);
                      const sideFlag = sideCode ? flagUrl(sideCode) : null;
                      const sideHcp = hcpSideValue(pendingPick, m);
                      content = (
                        <div title="Tip čeká na schválení Kubou" className="leading-tight text-rose-600">
                          <div className="text-center font-medium">
                            <span className="mr-0.5">?</span>
                            {pendingPick.home_score}:{pendingPick.away_score}
                          </div>
                          <div className="text-center text-[11px] text-rose-400">
                            {pendingPick.home_score_p1 != null
                              ? `(${pendingPick.home_score_p1}:${pendingPick.away_score_p1})`
                              : ""}
                          </div>
                          <div className="flex items-center gap-1 text-[11px] opacity-70">
                            {sideFlag && (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img
                                src={sideFlag}
                                alt={sideCode ?? ""}
                                className="h-[10px] w-auto rounded-sm shadow-sm"
                              />
                            )}
                            {sideHcp != null && <span>{sideHcp}</span>}
                          </div>
                        </div>
                      );
                    } else if (isMine && started && !inGrace && !isAdmin) {
                      // hráč nestihl tip - promeškal čas startu (i 10min grace)
                      content = (
                        <span title="Nestihl jsi tip" className="text-base">😞</span>
                      );
                    } else {
                      // chybějící tip: klikatelná buňka = tučné "+" (vyzývá k tipu), nekl. = pomlčka
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
                      : "#16a34a";
                    const cellStyle: React.CSSProperties = { width: 77 };
                    if (isMine) {
                      cellStyle.boxShadow = `inset 2px 0 0 ${myAccentColor}, inset -2px 0 0 ${myAccentColor}`;
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
          initialBg={colorTarget.bg_color}
          initialText={colorTarget.text_color}
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
  // Pokud existuje tip, předvyplnit. Jinak prázdné (mobile UX).
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

  // Refs pro sekvenční zadávání skóre na mobilu (auto-advance po každé číslici)
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
      setErr("Vyplň skóre po 60 minutách.");
      return;
    }
    if (h1 === "" || a1 === "") {
      setErr("Vyplň skóre po 1. třetině.");
      return;
    }
    const hsN = Number(hs);
    const asN = Number(as_);
    const h1N = Number(h1);
    const a1N = Number(a1);
    if (h1N > hsN || a1N > asN) {
      setErr("Skóre po 1. třetině nemůže být vyšší než finální skóre.");
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
        alert("Zápas už začal. Tvůj tip jsme uložili a čeká na schválení Kubou.");
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
    if (!confirm(`Smazat tip hráče ${targetUser.display_name}?`)) return;
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center">
          {asAdmin && (
            <p className="text-sm font-semibold text-neutral-700">
              {targetUser.display_name}
            </p>
          )}
          <h2 className="mt-1 inline-flex items-center gap-2 text-lg font-semibold">
            {homeFlag && <img src={homeFlag} alt={match.home_code} className="h-[15px] w-auto rounded-sm shadow-sm" />}
            <span className="md:hidden">{match.home_code}</span>
            <span className="hidden md:inline">{home?.name_cs}</span>
            <span className="text-neutral-400">vs</span>
            {awayFlag && <img src={awayFlag} alt={match.away_code} className="h-[15px] w-auto rounded-sm shadow-sm" />}
            <span className="md:hidden">{match.away_code}</span>
            <span className="hidden md:inline">{away?.name_cs}</span>
          </h2>
          <p className="mt-1 text-sm text-neutral-600">
            {new Date(match.starts_at).toLocaleString("cs-CZ", {
              weekday: "short",
              day: "numeric",
              month: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "Europe/Prague",
            })}
            {match.home_handicap != null && (
              <span className="ml-2">
                · handicap {match.home_handicap > 0 ? "+" : ""}
                {match.home_handicap}
              </span>
            )}
          </p>
        </div>

        <div className="mt-6 space-y-5">
          <div className="text-center">
            <label className="text-xs uppercase tracking-wide text-neutral-500">
              Skóre po 60 minutách
            </label>
            <div className="mt-1 flex items-center justify-center gap-3">
              <input
                ref={hsRef}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={1}
                value={hs}
                onChange={(e) => handleDigit(e.target.value, setHs, asRef)}
                onFocus={(e) => e.currentTarget.select()}
                className="w-20 rounded border px-3 py-2 text-center text-2xl"
                placeholder=""
                autoFocus
              />
              <span className="text-2xl">:</span>
              <input
                ref={asRef}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={1}
                value={as_}
                onChange={(e) => handleDigit(e.target.value, setAs, h1Ref)}
                onFocus={(e) => e.currentTarget.select()}
                className="w-20 rounded border px-3 py-2 text-center text-2xl"
                placeholder=""
              />
            </div>
          </div>

          <div className="text-center">
            <label className="text-xs uppercase tracking-wide text-neutral-500">
              Skóre po 1. třetině
            </label>
            <div className="mt-1 flex items-center justify-center gap-3">
              <input
                ref={h1Ref}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={1}
                value={h1}
                onChange={(e) => handleDigit(e.target.value, setH1, a1Ref)}
                onFocus={(e) => e.currentTarget.select()}
                className="w-20 rounded border px-3 py-2 text-center text-2xl"
                placeholder=""
              />
              <span className="text-2xl">:</span>
              <input
                ref={a1Ref}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={1}
                value={a1}
                onChange={(e) => handleDigit(e.target.value, setA1, saveBtnRef)}
                onFocus={(e) => e.currentTarget.select()}
                className="w-20 rounded border px-3 py-2 text-center text-2xl"
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
              Zrušit
            </button>
            <button
              ref={saveBtnRef}
              type="button"
              onClick={save}
              disabled={saving}
              className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {saving ? "Ukládám…" : "Uložit tip"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
