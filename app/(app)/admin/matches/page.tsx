import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SaveMatchButton } from "@/components/save-match-button";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { STAGE_LABEL, type Match, type Team } from "@/lib/types";
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

export default async function AdminMatchesPage({ searchParams }: { searchParams: Promise<{ added?: string }> }) {
  const sp = await searchParams;
  const justAdded = sp?.added === "1";
  const supabase = await createClient();
  const [{ data: matches }, { data: teams }] = await Promise.all([
    supabase.from("matches").select("*").order("game_no"),
    supabase.from("teams").select("*"),
  ]);
  const teamMap = new Map((teams ?? []).map((t) => [t.code, t as Team]));

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
    if (homeCode) update.home_code = homeCode;
    if (awayCode) update.away_code = awayCode;
    if (dateStr && timeStr) {
      const [yr, mo, da] = dateStr.split("-").map(Number);
      const [hh, mmRaw] = timeStr.split(":").map(Number);
      // Datum/čas přicházejí v Europe/Prague (CET/CEST). Přepočítáme na UTC ISO.
      update.starts_at = pragueLocalToUTC(yr, mo, da, hh, snap5(mmRaw)).toISOString();
    }

    await sb.from("matches").update(update).eq("id", id);
    revalidatePath("/admin/matches");
    revalidatePath("/schedule");
    revalidatePath("/leaderboard");
  }

  async function clearHandicap(formData: FormData) {
    "use server";
    const sb = await createClient();
    const id = Number(formData.get("id"));
    await sb.from("matches").update({ home_handicap: null }).eq("id", id);
    revalidatePath("/admin/matches");
    revalidatePath("/schedule");
  }

  async function clearResult(formData: FormData) {
    "use server";
    const sb = await createClient();
    const id = Number(formData.get("id"));
    await sb
      .from("matches")
      .update({
        home_score: null,
        away_score: null,
        home_score_p1: null,
        away_score_p1: null,
        finalized: false,
      })
      .eq("id", id);
    revalidatePath("/admin/matches");
    revalidatePath("/schedule");
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
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(16, 0, 0, 0);
    await sb.from("matches").insert({
      game_no: nextGameNo,
      starts_at: null,
      home_code: null,
      away_code: null,
      stage: "group",
    });
    revalidatePath("/admin/matches");
    revalidatePath("/");
    redirect("/admin/matches?added=1");
  }

  async function deleteMatch(formData: FormData) {
    "use server";
    const sb = await createClient();
    const id = Number(formData.get("id"));
    await sb.from("matches").delete().eq("id", id);
    revalidatePath("/admin/matches");
    revalidatePath("/");
    revalidatePath("/leaderboard");
  }

  async function swapGameNo(formData: FormData) {
    "use server";
    const sb = await createClient();
    const idA = Number(formData.get("idA"));
    const idB = Number(formData.get("idB"));
    const { data: a } = await sb.from("matches").select("game_no").eq("id", idA).maybeSingle();
    const { data: b } = await sb.from("matches").select("game_no").eq("id", idB).maybeSingle();
    if (!a || !b) return;
    // Swap via temp negative to avoid unique conflict
    await sb.from("matches").update({ game_no: -Math.abs(a.game_no) - 1000000 }).eq("id", idA);
    await sb.from("matches").update({ game_no: a.game_no }).eq("id", idB);
    await sb.from("matches").update({ game_no: b.game_no }).eq("id", idA);
    revalidatePath("/admin/matches");
    revalidatePath("/");
  }

  return (
    <main>
      <h1 className="mb-4 text-xl font-semibold">Zápasy & výsledky</h1>
        {justAdded && (
          <div className="mb-3 rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            ✓ Zápas přidán — vyplň údaje a ulož.
          </div>
        )}
        <form action={addMatch} className="mb-3">
          <button type="submit" className="rounded border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-50">
            + Přidat zápas
          </button>
        </form>

      <div className="space-y-2">
        {(matches ?? []).map((mx, idx, arr) => {
          const m = mx as Match;
          const home = teamMap.get(m.home_code);
          const away = teamMap.get(m.away_code);
          const { date: dateStr, time: timeStr } = m.starts_at ? pragueParts(m.starts_at) : { date: "", time: "" };
          const isCzech = m.is_czech;
          return (
            <div key={m.id + "_wrap"} className="flex items-start gap-2 flex-wrap">
            <form
              action={saveMatch}
              className={
                "w-[610px] max-w-full rounded border p-3 text-sm " +
                (isCzech ? "bg-red-50" : "bg-white")
              }
            >
              <input type="hidden" name="id" value={m.id} />

              <header className="mb-2 flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1.5 font-medium">
                  {m.home_code && <TeamFlag code={m.home_code} />}
                  <select
                    name="home_code"
                    defaultValue={m.home_code ?? ""}
                    className="rounded border px-1.5 py-0.5 text-sm"
                  >
                    <option value="">—</option>
                    {(teams ?? []).map((t) => (
                      <option key={t.code} value={t.code}>
                        {t.name_cs}
                      </option>
                    ))}
                  </select>
                  <span className="text-neutral-400">vs</span>
                  {m.away_code && <TeamFlag code={m.away_code} />}
                  <select
                    name="away_code"
                    defaultValue={m.away_code ?? ""}
                    className="rounded border px-1.5 py-0.5 text-sm"
                  >
                    <option value="">—</option>
                    {(teams ?? []).map((t) => (
                      <option key={t.code} value={t.code}>
                        {t.name_cs}
                      </option>
                    ))}
                  </select>
                </span>
                <span className="ml-auto inline-flex items-center gap-1 text-xs">
                  <span className="text-neutral-500">Hcp domácích:</span>
                  <input
                    name="home_handicap"
                    type="number"
                    step={1}
                    min={-9.5}
                    max={9.5}
                    defaultValue={m.home_handicap ?? ""}
                    className="w-12 rounded border px-2 py-1 text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    placeholder="±x.5"
                  />
                  <button
                    formAction={clearHandicap}
                    title="Vynulovat handicap"
                    className="rounded border border-neutral-300 px-1.5 py-0.5 text-neutral-500 hover:bg-neutral-100"
                  >
                    ×
                  </button>
                </span>
              </header>

              <div className="flex flex-wrap items-end gap-1">
                <div className="flex flex-col items-start text-xs">
                  <span className="text-neutral-500">Datum & čas</span>
                  <div className="mt-1 flex items-center gap-1">
                    <input
                      name="starts_date"
                      type="date"
                      defaultValue={dateStr}
                      className="rounded border px-2 py-1"
                    />
                    <TimePicker
                      name="starts_time"
                      defaultValue={timeStr}
                    />
                  </div>
                </div>

                <div className="flex flex-col items-center text-xs">
                <span className="text-neutral-500">Skóre 60′</span>
                  <div className="mt-1 flex items-center gap-1">
                    <input
                      name="home_score"
                      type="number"
                      min={0}
                      defaultValue={m.home_score ?? ""}
                      className="w-12 rounded border px-2 py-1 text-center"
                    />
                    <span>:</span>
                    <input
                      name="away_score"
                      type="number"
                      min={0}
                      defaultValue={m.away_score ?? ""}
                      className="w-12 rounded border px-2 py-1 text-center"
                    />
                  </div>
                </div>

                <div className="flex flex-col items-center text-xs">
                  <span className="text-neutral-500">1. třetina</span>
                  <div className="mt-1 flex items-center gap-1">
                    <input
                      name="home_score_p1"
                      type="number"
                      min={0}
                      defaultValue={m.home_score_p1 ?? ""}
                      className="w-12 rounded border px-2 py-1 text-center"
                    />
                    <span>:</span>
                    <input
                      name="away_score_p1"
                      type="number"
                      min={0}
                      defaultValue={m.away_score_p1 ?? ""}
                      className="w-12 rounded border px-2 py-1 text-center"
                    />
                  </div>
                </div>

                <SaveMatchButton />
              </div>

              <div className="mt-2 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 text-neutral-500">
                <label className="flex items-center gap-1">
                  Tag
                  <input
                    name="tag"
                    type="text"
                    maxLength={6}
                    defaultValue={m.tag ?? ""}
                    className="w-16 rounded border px-2 py-1 text-center"
                  />
                </label>
                <label className="flex items-center gap-1">
                  Hcp body
                  <input
                    name="hcp_override_points"
                    type="number"
                    min={0}
                    max={99}
                    defaultValue={m.hcp_override_points ?? ""}
                    className={
                      "w-12 rounded border px-2 py-1 text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none " +
                      (m.tag && m.hcp_override_points == null ? "border-red-500 ring-1 ring-red-500" : "")
                    }
                  />
                </label>
              </div>
                <div>
                  {m.finalized && (
                    <button
                    formAction={clearResult}
                    className="rounded border border-rose-300 bg-white px-2 py-1 text-xs text-rose-700 hover:bg-rose-50"
                  >
                    Smazat výsledek
                  </button>
                  )}
                </div>
              </div>
            </form>
            <div className="flex flex-col items-center gap-1 rounded border bg-white p-2">
              {idx > 0 && (
                <form action={swapGameNo}>
                  <input type="hidden" name="idA" value={m.id} />
                  <input type="hidden" name="idB" value={arr[idx - 1].id} />
                  <button type="submit" title="Posunout nahoru" className="rounded border px-2 py-1 text-xs hover:bg-neutral-50">↑</button>
                </form>
              )}
              {idx < arr.length - 1 && (
                <form action={swapGameNo}>
                  <input type="hidden" name="idA" value={m.id} />
                  <input type="hidden" name="idB" value={arr[idx + 1].id} />
                  <button type="submit" title="Posunout dolů" className="rounded border px-2 py-1 text-xs hover:bg-neutral-50">↓</button>
                </form>
              )}
              <form action={deleteMatch}>
                <input type="hidden" name="id" value={m.id} />
                <ConfirmDeleteButton />
              </form>
            </div>
          </div>
            );
        })}
      </div>
    </main>
  );
}
             