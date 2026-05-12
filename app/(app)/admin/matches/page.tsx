import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { SaveMatchButton } from "@/components/save-match-button";
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

export default async function AdminMatchesPage() {
  const supabase = await createClient();
  const [{ data: matches }, { data: teams }] = await Promise.all([
    supabase.from("matches").select("*").order("starts_at"),
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

  return (
    <main>
      <h1 className="mb-4 text-xl font-semibold">Zápasy & výsledky</h1>

      <div className="space-y-2">
        {(matches ?? []).map((mx) => {
          const m = mx as Match;
          const home = teamMap.get(m.home_code);
          const away = teamMap.get(m.away_code);
          const { date: dateStr, time: timeStr } = pragueParts(m.starts_at);
          const isCzech = m.is_czech;
          return (
            <form
              key={m.id}
              action={saveMatch}
              className={
                "w-[610px] max-w-full rounded border p-3 text-sm " +
                (isCzech ? "bg-red-50" : "bg-white")
              }
            >
              <input type="hidden" name="id" value={m.id} />

              <header className="mb-2 flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <TeamFlag code={m.home_code} />
                  <select
                    name="home_code"
                    defaultValue={m.home_code}
                    className="rounded border px-1.5 py-0.5 text-sm"
                  >
                    {(teams ?? []).map((t) => (
                      <option key={t.code} value={t.code}>
                        {t.name_cs}
                      </option>
                    ))}
                  </select>
                  <span className="text-neutral-400">vs</span>
                  <TeamFlag code={m.away_code} />
                  <select
                    name="away_code"
                    defaultValue={m.away_code}
                    className="rounded border px-1.5 py-0.5 text-sm"
                  >
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
                    className="w-10 rounded border px-2 py-1 text-center"
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

                <div className="flex items-center gap-2">
                <SaveMatchButton />
                {m.finalized && (
                  <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">
                    finalizováno
                  </span>
                )}
              </div>
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
                    placeholder="–"
                    className="w-12 rounded border px-2 py-1 text-center"
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
          );
        })}
      </div>
    </main>
  );
}
             