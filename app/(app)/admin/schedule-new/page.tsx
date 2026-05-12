import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SaveMatchButton } from "@/components/save-match-button";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { type Match, type Team } from "@/lib/types";
import { TimePicker } from "@/components/time-picker";
import { pragueLocalToUTC, pragueParts, snap5 } from "@/lib/tz";

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

function TeamFlag({ code }: { code: string }) {
  const url = flagUrl(code);
  if (!url) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={url}
      alt={code}
      className="inline-block h-[15px] w-auto rounded-sm shadow-sm align-middle"
    />
  );
}


const DAY_NAMES = ["Neděle", "Pondělí", "Úterý", "Středa", "Čtvrtek", "Pátek", "Sobota"];
function dayHeader(isoDate: string): string {
  const [y, mo, d] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(y, mo - 1, d));
  const dayName = DAY_NAMES[date.getUTCDay()];
  return `${dayName} ${d}.${mo}.${y}`;
}

export default async function ScheduleNewPage({
  searchParams,
}: {
  searchParams: Promise<{ added?: string }>;
}) {
  const sp = await searchParams;
  const justAdded = sp?.added === "1";

  const supabase = await createClient();
  const [{ data: matches }, { data: teams }] = await Promise.all([
    supabase.from("matches").select("*").order("game_no"),
    supabase.from("teams").select("*").order("name_cs"),
  ]);
  const teamMap = new Map((teams ?? []).map((t) => [(t as Team).code, t as Team]));

  async function saveMatch(formData: FormData) {
    "use server";
    const sb = await createClient();
    const id = Number(formData.get("id"));
    const num = (k: string) => {
      const v = formData.get(k);
      return v === "" || v == null ? null : Number(v);
    };
    const dateStr = String(formData.get("starts_date") ?? "");
    const timeStr = String(formData.get("starts_time") ?? "");
    const home_score = num("home_score");
    const away_score = num("away_score");
    const homeCode = String(formData.get("home_code") ?? "");
    const awayCode = String(formData.get("away_code") ?? "");
    const update: Record<string, unknown> = {
      home_handicap: num("home_handicap"),
      tag: ((formData.get("tag") as string | null) ?? "").trim() || null,
      hcp_override_points: num("hcp_override_points"),
      home_score,
      away_score,
      home_score_p1: num("home_score_p1"),
      away_score_p1: num("away_score_p1"),
      finalized: home_score != null && away_score != null,
    };
    update.home_code = homeCode || null;
    update.away_code = awayCode || null;
    if (dateStr && timeStr) {
      const [yr, mo, da] = dateStr.split("-").map(Number);
      const [hh, mmRaw] = timeStr.split(":").map(Number);
      update.starts_at = pragueLocalToUTC(yr, mo, da, hh, snap5(mmRaw)).toISOString();
    } else if (!dateStr && !timeStr) {
      update.starts_at = null;
    }
    await sb.from("matches").update(update).eq("id", id);
    revalidatePath("/admin/schedule-new");
    revalidatePath("/admin/matches");
    revalidatePath("/");
    revalidatePath("/leaderboard");
  }

  async function addMatch() {
    "use server";
    const sb = await createClient();
    const { data: maxRow } = await sb
      .from("matches")
      .select("game_no")
      .order("game_no", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextGameNo = (maxRow?.game_no ?? 0) + 1;
    await sb.from("matches").insert({
      game_no: nextGameNo,
      starts_at: null,
      home_code: null,
      away_code: null,
      stage: "group",
    });
    revalidatePath("/admin/schedule-new");
    revalidatePath("/admin/matches");
    redirect("/admin/schedule-new?added=1");
  }

  async function deleteMatch(formData: FormData) {
    "use server";
    const sb = await createClient();
    const id = Number(formData.get("id"));
    await sb.from("matches").delete().eq("id", id);
    revalidatePath("/admin/schedule-new");
    revalidatePath("/admin/matches");
    revalidatePath("/");
  }

  async function swapGameNo(formData: FormData) {
    "use server";
    const sb = await createClient();
    const idA = Number(formData.get("idA"));
    const idB = Number(formData.get("idB"));
    const { data: a } = await sb.from("matches").select("game_no").eq("id", idA).maybeSingle();
    const { data: b } = await sb.from("matches").select("game_no").eq("id", idB).maybeSingle();
    if (!a || !b) return;
    await sb.from("matches").update({ game_no: -Math.abs(a.game_no) - 1000000 }).eq("id", idA);
    await sb.from("matches").update({ game_no: a.game_no }).eq("id", idB);
    await sb.from("matches").update({ game_no: b.game_no }).eq("id", idA);
    revalidatePath("/admin/schedule-new");
    revalidatePath("/admin/matches");
  }

  const matchesArr = (matches ?? []) as Match[];

  return (
    <main className="mx-auto max-w-3xl px-4 py-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Rozpis a výsledky</h1>
        <form action={addMatch}>
          <button
            type="submit"
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-emerald-700"
          >
            + Přidat zápas
          </button>
        </form>
      </div>

      {justAdded && (
        <div className="mb-3 rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          ✓ Zápas přidán — rozklikni dole a vyplň údaje.
        </div>
      )}

      <div className="space-y-1">
        {matchesArr.map((m, idx, arr) => {
          const dt = m.starts_at ? pragueParts(m.starts_at) : { date: "", time: "" };
          const prev = idx > 0 ? arr[idx - 1] : null;
          const prevDate = prev?.starts_at ? pragueParts(prev.starts_at).date : "";
          const showDayHeader = !!dt.date && dt.date !== prevDate;
          const showDraftHeader = !dt.date && !!prev?.starts_at;
          const isCzech = m.is_czech;
          const isDraft = !m.starts_at;
          const finalized = m.finalized;
          const home = m.home_code ? teamMap.get(m.home_code) : null;
          const away = m.away_code ? teamMap.get(m.away_code) : null;
          const tagMissingHcp = !!m.tag && m.hcp_override_points == null;

          return (
            <div key={m.id}>
              {showDayHeader && (
                <div className="mt-4 mb-2 border-b border-neutral-200 pb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  {dayHeader(dt.date)}
                </div>
              )}
              {showDraftHeader && (
                <div className="mt-4 mb-2 border-b border-amber-200 pb-1 text-xs font-semibold uppercase tracking-wide text-amber-700">
                  Nezařazené (drafty)
                </div>
              )}

              <div className="flex items-start gap-2">
                <details
                  className={
                    "group flex-1 min-w-0 rounded-md border overflow-hidden " +
                    (isDraft
                      ? "border-amber-300 bg-amber-50"
                      : finalized
                      ? "border-emerald-300 bg-emerald-50/40"
                      : isCzech
                      ? "border-red-200 bg-red-50/60"
                      : "border-neutral-200 bg-white")
                  }
                >
                <summary className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm select-none">
                  <span className="w-20 shrink-0 text-xs text-neutral-600 tabular-nums">
                    {dt.date ? `${dt.date.slice(8, 10)}.${dt.date.slice(5, 7)}.` : "—"}{" "}
                    {dt.time || ""}
                  </span>
                  <span className="flex w-[180px] shrink-0 items-center gap-2">
                    <span className="inline-flex w-6 shrink-0 justify-center">
                      <TeamFlag code={m.home_code ?? ""} />
                    </span>
                    <span className="inline-block w-10 shrink-0 text-center text-[10px] text-neutral-700">
                      {m.home_handicap != null
                        ? (m.home_handicap > 0 ? `+${m.home_handicap}` : m.home_handicap)
                        : ""}
                    </span>
                    <span className="truncate font-medium">{home?.name_cs ?? (m.home_code ?? "—")}</span>
                  </span>
                  <span className="flex w-[180px] shrink-0 items-center gap-2">
                    <span className="inline-flex w-6 shrink-0 justify-center">
                      <TeamFlag code={m.away_code ?? ""} />
                    </span>
                    <span className="inline-block w-10 shrink-0 text-center text-[10px] text-neutral-700">
                      {m.home_handicap != null
                        ? (-m.home_handicap > 0 ? `+${-m.home_handicap}` : -m.home_handicap)
                        : ""}
                    </span>
                    <span className="truncate font-medium">{away?.name_cs ?? (m.away_code ?? "—")}</span>
                  </span>
                  <span className="font-mono text-base tabular-nums w-20 text-center">
                    {m.home_score != null && m.away_score != null
                      ? `${m.home_score} : ${m.away_score}`
                      : "— : —"}
                  </span>
                  {m.tag && (
                    <span
                      className={
                        "ml-auto rounded px-1.5 py-0.5 text-[11px] font-medium " +
                        (tagMissingHcp ? "bg-red-100 text-red-800" : "bg-blue-100 text-blue-800")
                      }
                      title={tagMissingHcp ? "Chybí počet bodů (Hcp body)" : ""}
                    >
                      {m.tag}
                    </span>
                  )}
                </summary>

                <div className="border-t bg-white px-3 py-3">
                  <form action={saveMatch} className="grid grid-cols-[110px_70px_140px_100px_1fr] items-end gap-2">
                    <input type="hidden" name="id" value={m.id} />
                    {/* Row 1: Datum, Čas, Domácí, Handicap, Hosté */}
                    <label className="flex flex-col text-xs text-neutral-600">
                      Datum
                      <input
                        name="starts_date"
                        type="date"
                        defaultValue={dt.date}
                        className="rounded border px-2 py-1 text-sm"
                      />
                    </label>
                    <label className="flex flex-col text-xs text-neutral-600">
                      Čas
                      <div className="w-full [&>button]:w-full">
                        <TimePicker name="starts_time" defaultValue={dt.time} />
                      </div>
                    </label>
                    <label className="flex flex-col text-xs text-neutral-600">
                      Domácí
                      <select
                        name="home_code"
                        defaultValue={m.home_code ?? ""}
                        className="rounded border px-2 py-1 text-sm w-full"
                      >
                        <option value="">—</option>
                        {(teams ?? []).map((t) => (
                          <option key={(t as Team).code} value={(t as Team).code}>
                            {(t as Team).name_cs}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col text-xs text-neutral-600">
                      Handicap
                      <input
                        name="home_handicap"
                        type="number"
                        step={1}
                        min={-9.5}
                        max={9.5}
                        defaultValue={m.home_handicap ?? ""}
                        className="rounded border px-2 py-1 text-center text-sm [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      />
                    </label>
                    <label className="flex flex-col text-xs text-neutral-600">
                      Hosté
                      <select
                        name="away_code"
                        defaultValue={m.away_code ?? ""}
                        className="rounded border px-2 py-1 text-sm w-full"
                      >
                        <option value="">—</option>
                        {(teams ?? []).map((t) => (
                          <option key={(t as Team).code} value={(t as Team).code}>
                            {(t as Team).name_cs}
                          </option>
                        ))}
                      </select>
                    </label>
                    {/* Row 2: Tag, Hcp body, Skóre (under Domácí), 1. třetina (under Handicap), Uložit (under Hosté) */}
                    <label className="flex flex-col text-xs text-neutral-600">
                      Tag
                      <input
                        name="tag"
                        type="text"
                        maxLength={6}
                        defaultValue={m.tag ?? ""}
                        className="w-full rounded border px-2 py-1 text-center text-sm"
                      />
                    </label>
                    <label className="flex flex-col text-xs text-neutral-600">
                      Hcp body
                      <input
                        name="hcp_override_points"
                        type="number"
                        min={0}
                        max={99}
                        defaultValue={m.hcp_override_points ?? ""}
                        className={
                          "w-full rounded border px-1 py-1 text-center text-sm [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none " +
                          (tagMissingHcp ? "border-red-500 ring-1 ring-red-500" : "")
                        }
                      />
                    </label>
                    <label className="flex flex-col text-xs text-neutral-600">
                      Skóre 60′
                      <div className="mt-0.5 flex items-center gap-1">
                        <input
                          name="home_score"
                          type="number"
                          min={0}
                          defaultValue={m.home_score ?? ""}
                          className="w-10 rounded border px-1.5 py-1 text-center text-sm [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        />
                        <span>:</span>
                        <input
                          name="away_score"
                          type="number"
                          min={0}
                          defaultValue={m.away_score ?? ""}
                          className="w-10 rounded border px-1.5 py-1 text-center text-sm [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        />
                      </div>
                    </label>
                    <label className="flex flex-col text-xs text-neutral-600">
                      1. třetina
                      <div className="mt-0.5 flex items-center gap-1">
                        <input
                          name="home_score_p1"
                          type="number"
                          min={0}
                          defaultValue={m.home_score_p1 ?? ""}
                          className="w-10 rounded border px-1.5 py-1 text-center text-sm [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        />
                        <span>:</span>
                        <input
                          name="away_score_p1"
                          type="number"
                          min={0}
                          defaultValue={m.away_score_p1 ?? ""}
                          className="w-10 rounded border px-1.5 py-1 text-center text-sm [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        />
                      </div>
                    </label>
                    <div className="flex items-end">
                      <SaveMatchButton />
                    </div>
                  </form>


                </div>
                </details>
                <div className="flex flex-row items-center gap-1 rounded-md border bg-white p-1.5">
                  <form action={swapGameNo} className={idx === 0 ? "invisible pointer-events-none" : ""} aria-hidden={idx === 0}>
                    <input type="hidden" name="idA" value={m.id} />
                    <input type="hidden" name="idB" value={idx > 0 ? arr[idx - 1].id : m.id} />
                    <button type="submit" tabIndex={idx === 0 ? -1 : 0} title="Posunout nahoru" className="rounded border px-2.5 py-1 text-base leading-none hover:bg-neutral-50">↑</button>
                  </form>
                  <form action={swapGameNo} className={idx === arr.length - 1 ? "invisible pointer-events-none" : ""} aria-hidden={idx === arr.length - 1}>
                    <input type="hidden" name="idA" value={m.id} />
                    <input type="hidden" name="idB" value={idx < arr.length - 1 ? arr[idx + 1].id : m.id} />
                    <button type="submit" tabIndex={idx === arr.length - 1 ? -1 : 0} title="Posunout dolů" className="rounded border px-2.5 py-1 text-base leading-none hover:bg-neutral-50">↓</button>
                  </form>
                  <form action={deleteMatch}>
                    <input type="hidden" name="id" value={m.id} />
                    <ConfirmDeleteButton />
                  </form>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
