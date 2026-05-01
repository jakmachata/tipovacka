import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { STAGE_LABEL, type Match, type Team } from "@/lib/types";
import { TimePicker } from "@/components/time-picker";

const pad = (n: number) => String(n).padStart(2, "0");

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

function toDateStr(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function toTimeStr(iso: string) {
  const d = new Date(iso);
  const m = Math.round(d.getMinutes() / 5) * 5 % 60;
  return `${pad(d.getHours())}:${pad(m)}`;
}

function TeamFlag({ code }: { code: string }) {
  const url = flagUrl(code);
  if (!url) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={url}
      width={20}
      height={15}
      alt={code}
      className="inline-block rounded-sm shadow-sm align-middle"
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

    const update: Record<string, unknown> = {
      home_handicap: num("home_handicap"),
      home_score,
      away_score,
      home_score_p1: num("home_score_p1"),
      away_score_p1: num("away_score_p1"),
      finalized: home_score != null && away_score != null,
    };
    if (dateStr && timeStr) {
      const [yr, mo, da] = dateStr.split("-").map(Number);
      const [hh, mm] = timeStr.split(":").map(Number);
      const d = new Date(yr, mo - 1, da, hh, Math.round(mm / 5) * 5 % 60, 0, 0);
      update.starts_at = d.toISOString();
    }

    await sb.from("matches").update(update).eq("id", id);
    revalidatePath("/admin/matches");
    revalidatePath("/schedule");
    revalidatePath("/leaderboard");
  }

  return (
    <main>
      <h1 className="mb-1 text-xl font-semibold">Zápasy & výsledky</h1>
      <p className="mb-4 text-sm text-neutral-600">
        Uprav datum/čas, handicap a výsledky. Po uložení se body přepočítají.
      </p>

      <div className="space-y-2">
        {(matches ?? []).map((mx) => {
          const m = mx as Match;
          const home = teamMap.get(m.home_code);
          const away = teamMap.get(m.away_code);
          return (
            <form
              key={m.id}
              action={saveMatch}
              className="rounded border bg-white p-3 text-sm"
            >
              <input type="hidden" name="id" value={m.id} />

              <header className="mb-2 flex flex-wrap items-center gap-3">
                <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700">
                  {STAGE_LABEL[m.stage]}
                </span>
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <TeamFlag code={m.home_code} />
                  <span>{home?.name_cs}</span>
                  <span className="text-neutral-400">vs</span>
                  <TeamFlag code={m.away_code} />
                  <span>{away?.name_cs}</span>
                </span>
              </header>

              <div className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col items-start text-xs">
                  <span className="text-neutral-500">Datum & čas</span>
                  <div className="mt-1 flex items-center gap-1">
                    <input
                      name="starts_date"
                      type="date"
                      defaultValue={toDateStr(m.starts_at)}
                      className="rounded border px-2 py-1"
                    />
                    <TimePicker
                      name="starts_time"
                      defaultValue={toTimeStr(m.starts_at)}
                    />
                  </div>
                </div>

                <label className="text-xs">
                  <span className="block text-neutral-500">Hcp domácích</span>
                  <input
                    name="home_handicap"
                    type="number"
                    step={1}
                    min={-9.5}
                    max={9.5}
                    defaultValue={m.home_handicap ?? ""}
                    className="w-20 rounded border px-2 py-1 text-center"
                    placeholder="±x.5"
                  />
                </label>

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

                <button className="rounded bg-neutral-900 px-3 py-1.5 text-xs text-white hover:bg-neutral-800">
                  Uložit
                </button>
              </div>
            </form>
          );
        })}
      </div>
    </main>
  );
}
