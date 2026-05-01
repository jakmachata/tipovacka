"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Match, Pick, Profile, Team, Score } from "@/lib/types";

interface PlayerWithTotal extends Profile {
  total?: number;
}

interface Props {
  myUserId: string;
  matches: Match[];
  teams: Team[];
  players: PlayerWithTotal[];
  picks: Pick[];
  scores: Score[];
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString("cs-CZ", {
    day: "numeric",
    month: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function teamLabel(t: Team | undefined, hcp: number | null, isHome: boolean) {
  if (!t) return "?";
  const v = hcp == null ? null : isHome ? hcp : -hcp;
  const sign = v === null ? "" : v > 0 ? `+${v}` : `${v}`;
  return `${t.flag_emoji ?? ""} ${t.name_cs}${v === null ? "" : ` (${sign})`}`;
}

// Given a pick + match, return label like "FIN -2.5" of the side the pick is on
function hcpSideLabel(
  pick: { home_score: number; away_score: number },
  match: Match,
): string {
  const hcp = match.home_handicap;
  if (hcp == null) return "";
  const diff = pick.home_score - pick.away_score;
  let sideHome: boolean;
  if (diff > 0) sideHome = true;
  else if (diff < 0) sideHome = false;
  else sideHome = hcp >= 0;
  const code = sideHome ? match.home_code : match.away_code;
  const v = sideHome ? hcp : -hcp;
  const sign = v > 0 ? `+${v}` : `${v}`;
  return `${code} ${sign}`;
}

export function TipMatrix({
  myUserId,
  matches,
  teams,
  players,
  picks,
  scores,
}: Props) {
  const [editingMatchId, setEditingMatchId] = useState<number | null>(null);

  const teamMap = new Map(teams.map((t) => [t.code, t]));
  const k = (uid: string, mid: number) => `${uid}|${mid}`;
  const pickMap = new Map(picks.map((p) => [k(p.user_id, p.match_id), p]));
  const scoreMap = new Map(scores.map((s) => [k(s.user_id, s.match_id), s]));

  const editingMatch =
    editingMatchId == null
      ? null
      : matches.find((m) => m.id === editingMatchId) ?? null;
  const myExisting =
    editingMatchId == null ? null : pickMap.get(k(myUserId, editingMatchId)) ?? null;

  return (
    <main>
      <h1 className="mb-2 text-2xl font-semibold">Zápasy</h1>
      <p className="mb-4 text-sm text-neutral-600">
        Klikni do svého políčka u zápasu — zadáš skóre po 60. min a (volitelně) po 1. třetině.
        Cizí tipy se odhalí v okamžiku startu zápasu (zámeček). Handicap se z tvého rozdílu skóre odvodí sám.
      </p>

      <div className="-mx-4 overflow-x-auto px-4">
        <table className="min-w-full text-xs">
          <thead className="sticky top-0 z-10 bg-white border-b text-neutral-500">
            <tr>
              <th className="px-2 py-2 text-left">#</th>
              <th className="px-2 py-2 text-left whitespace-nowrap">Datum</th>
              <th className="px-2 py-2 text-left whitespace-nowrap">Domácí</th>
              <th className="px-2 py-2 text-left whitespace-nowrap">Hosté</th>
              <th className="px-2 py-2 text-right">60′</th>
              <th className="px-2 py-2 text-right whitespace-nowrap">1. tř.</th>
              {players.map((p) => (
                <th
                  key={p.id}
                  className={
                    "px-2 py-2 text-center whitespace-nowrap " +
                    (p.id === myUserId ? "bg-amber-50" : "")
                  }
                >
                  <div>{p.display_name}</div>
                  <div className="text-[10px] font-normal text-neutral-400">
                    ({p.total ?? 0})
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matches.map((m) => {
              const home = teamMap.get(m.home_code);
              const away = teamMap.get(m.away_code);
              const started = new Date(m.starts_at).getTime() <= Date.now();
              const result = m.finalized
                ? `${m.home_score}:${m.away_score}`
                : "—";
              const result1 =
                m.finalized && m.home_score_p1 != null
                  ? `${m.home_score_p1}:${m.away_score_p1}`
                  : "—";
              return (
                <tr key={m.id} className="border-b hover:bg-neutral-50">
                  <td className="px-2 py-2 text-neutral-400">{m.game_no}</td>
                  <td className="px-2 py-2 whitespace-nowrap text-neutral-600">
                    {fmt(m.starts_at)}
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap font-medium">
                    {teamLabel(home, m.home_handicap, true)}
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap font-medium">
                    {teamLabel(away, m.home_handicap, false)}
                  </td>
                  <td className="px-2 py-2 text-right font-semibold">{result}</td>
                  <td className="px-2 py-2 text-right text-neutral-500">
                    {result1}
                  </td>

                  {players.map((p) => {
                    const pick = pickMap.get(k(p.id, m.id));
                    const score = scoreMap.get(k(p.id, m.id));
                    const isMine = p.id === myUserId;
                    const visible = isMine || started;
                    const clickable = isMine && !started;

                    let content: React.ReactNode;
                    if (!visible) {
                      content = <span className="text-neutral-400">🔒</span>;
                    } else if (pick) {
                      const hcpLine = m.home_handicap != null ? hcpSideLabel(pick, m) : "";
                      content = (
                        <div className="leading-tight">
                          <div className="font-medium">
                            {pick.home_score}:{pick.away_score}
                            {pick.home_score_p1 != null && (
                              <span className="ml-1 text-[10px] text-neutral-500">
                                ({pick.home_score_p1}:{pick.away_score_p1})
                              </span>
                            )}
                          </div>
                          {hcpLine && (
                            <div className="text-[10px] text-neutral-500">{hcpLine}</div>
                          )}
                          {score && score.total_points > 0 && (
                            <div className="text-[10px] font-semibold text-emerald-700">
                              +{score.total_points}
                            </div>
                          )}
                        </div>
                      );
                    } else {
                      content = <span className="text-neutral-400">{isMine ? "+ tip" : "—"}</span>;
                    }

                    return (
                      <td
                        key={p.id}
                        onClick={clickable ? () => setEditingMatchId(m.id) : undefined}
                        className={
                          "px-2 py-2 text-center " +
                          (isMine ? "bg-amber-50 " : "") +
                          (clickable ? "cursor-pointer hover:bg-amber-100" : "")
                        }
                      >
                        {content}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editingMatch && (
        <TipModal
          match={editingMatch}
          existing={myExisting}
          teamMap={teamMap}
          onClose={() => setEditingMatchId(null)}
          onSaved={() => {
            setEditingMatchId(null);
            location.reload();
          }}
        />
      )}
    </main>
  );
}

function TipModal({
  match,
  existing,
  teamMap,
  onClose,
  onSaved,
}: {
  match: Match;
  existing: Pick | null;
  teamMap: Map<string, Team>;
  onClose: () => void;
  onSaved: () => void;
}) {
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

  const home = teamMap.get(match.home_code);
  const away = teamMap.get(match.away_code);
  const p1Filled = h1 !== "" || a1 !== "";

  async function save() {
    if (hs === "" || as_ === "") {
      setErr("Vyplň skóre po 60. minutě.");
      return;
    }
    if (p1Filled && (h1 === "" || a1 === "")) {
      setErr("U 1. třetiny vyplň obě čísla, nebo nech obě prázdná.");
      return;
    }
    setSaving(true);
    setErr("");
    const sb = createClient();
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user) {
      setErr("Nepřihlášen");
      setSaving(false);
      return;
    }
    const payload = {
      user_id: user.id,
      match_id: match.id,
      home_score: Number(hs),
      away_score: Number(as_),
      home_score_p1: p1Filled ? Number(h1) : null,
      away_score_p1: p1Filled ? Number(a1) : null,
    };
    const { error } = await sb.from("picks").upsert(payload);
    setSaving(false);
    if (error) setErr(error.message);
    else onSaved();
  }

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
          <p className="text-xs uppercase tracking-wide text-neutral-500">
            Tip — zápas {match.game_no}
          </p>
          <h2 className="mt-1 text-lg font-semibold">
            {home?.flag_emoji} {home?.name_cs} vs {away?.flag_emoji} {away?.name_cs}
          </h2>
          <p className="mt-1 text-sm text-neutral-600">
            {new Date(match.starts_at).toLocaleString("cs-CZ", {
              weekday: "short",
              day: "numeric",
              month: "numeric",
              hour: "2-digit",
              minute: "2-digit",
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
              Skóre po 60. minutě
            </label>
            <div className="mt-1 flex items-center justify-center gap-3">
              <input
                type="number"
                min={0}
                value={hs}
                onChange={(e) => setHs(e.target.value)}
                className="w-20 rounded border px-3 py-2 text-center text-2xl"
                placeholder="0"
                autoFocus
              />
              <span className="text-2xl">:</span>
              <input
                type="number"
                min={0}
                value={as_}
                onChange={(e) => setAs(e.target.value)}
                className="w-20 rounded border px-3 py-2 text-center text-2xl"
                placeholder="0"
              />
            </div>
          </div>

          <div className="text-center">
            <label className="text-xs uppercase tracking-wide text-neutral-500">
              Skóre po 1. třetině (volitelné, +1 bod za přesný tip)
            </label>
            <div className="mt-1 flex items-center justify-center gap-3">
              <input
                type="number"
                min={0}
                value={h1}
                onChange={(e) => setH1(e.target.value)}
                className="w-16 rounded border px-3 py-2 text-center"
                placeholder="—"
              />
              <span>:</span>
              <input
                type="number"
                min={0}
                value={a1}
                onChange={(e) => setA1(e.target.value)}
                className="w-16 rounded border px-3 py-2 text-center"
                placeholder="—"
              />
            </div>
          </div>
        </div>

        {err && <p className="mt-3 text-sm text-rose-600 text-center">{err}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border px-4 py-2 text-sm hover:bg-neutral-50"
          >
            Zrušit
          </button>
          <button
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
  );
}
