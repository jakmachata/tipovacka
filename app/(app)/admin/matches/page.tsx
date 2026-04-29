import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { STAGE_LABEL, type Match, type Team } from "@/lib/types";

function fmt(iso: string) {
  return new Date(iso).toLocaleString("cs-CZ", {
    weekday: "short", day: "numeric", month: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default async function AdminMatchesPage() {
  const supabase = await createClient();
  const [{ data: matches }, { data: teams }] = await Promise.all([
    supabase.from("matches").select("*").order("starts_at"),
    supabase.from("teams").select("*"),
  ]);
  const teamMap = new Map((teams ?? []).map((t) => [t.code, t as Team]));

  async function fetchOdds(_formData: FormData) {
    "use server";
    // TODO: integrace na the-odds-api.com / Tipsport scraper.
    // Zatím no-op s návratem hlášky — handicap se nastavuje ručně níž.
    return;
  }

  async function setHandicap(formData: FormData) {
    "use server";
    const sb = await createClient();
    const id = Number(formData.get("id"));
    const v = formData.get("home_handicap");
    const home_handicap = v === "" || v == null ? null : Number(v);
    await sb.from("matches").update({ home_handicap }).eq("id", id);
    revalidatePath("/admin/matches");
  }

  async function setResults(formData: FormData) {
    "use server";
    const sb = await createClient();
    const id = Number(formData.get("id"));
    const get = (k: string) => {
      const v = formData.get(k);
      return v === "" || v == null ? null : Number(v);
    };
    await sb
      .from("matches")
      .update({
        home_score: get("home_score"),
        away_score: get("away_score"),
        home_score_p1: get("home_score_p1"),
        away_score_p1: get("away_score_p1"),
        finalized: formData.get("finalized") === "on",
      })
      .eq("id", id);
    revalidatePath("/admin/matches");
    revalidatePath("/leaderboard");
  }

  return (
    <main>
      <h1 className="mb-4 text-xl font-semibold">Zápasy & výsledky</h1>
      <p className="mb-4 text-sm text-neutral-600">
        „Stáhnout odds" zatím no-op (zdroj pro IIHF MS ještě není ověřen).
        Použij ruční pole vedle.
      </p>

      <div className="space-y-3">
        {(matches ?? []).map((mx) => {
          const m = mx as Match;
          const home = teamMap.get(m.home_code);
          const away = teamMap.get(m.away_code);
          return (
            <article key={m.id} className="rounded border bg-white p-3 text-sm">
              <header className="flex flex-wrap items-center gap-3">
                <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs">
                  {STAGE_LABEL[m.stage]}
                </span>
                <span className="text-neutral-500">{fmt(m.starts_at)}</span>
                <span className="font-medium">
                  {home?.flag_emoji} {home?.name_cs} vs {away?.flag_emoji} {away?.name_cs}
                </span>
                {m.finalized && <span className="text-xs text-emerald-700">finalizováno</span>}
              </header>

              <div className="mt-3 grid gap-3 md:grid-cols-3">
                {/* handicap */}
                <form action={setHandicap} className="flex items-end gap-2">
                  <input type="hidden" name="id" value={m.id} />
                  <label className="text-xs">
                    <span className="block text-neutral-500">Hcp domácích</span>
                    <input
                      name="home_handicap" type="number" step="0.5"
                      defaultValue={m.home_handicap ?? ""}
                      className="w-24 rounded border px-2 py-1"
                    />
                  </label>
                  <button className="rounded bg-neutral-900 px-2 py-1 text-xs text-white">
                    Uložit
                  </button>
                  <form action={fetchOdds} className="inline">
                    <input type="hidden" name="id" value={m.id} />
                    <button className="rounded border px-2 py-1 text-xs" disabled>
                      Stáhnout odds
                    </button>
                  </form>
                </form>

                {/* result */}
                <form action={setResults} className="flex flex-wrap items-end gap-2 md:col-span-2">
                  <input type="hidden" name="id" value={m.id} />
                  <label className="text-xs">
                    <span className="block text-neutral-500">60′</span>
                    <span className="flex items-center gap-1">
                      <input name="home_score" type="number" min={0}
                        defaultValue={m.home_score ?? ""}
                        className="w-14 rounded border px-2 py-1" />
                      :
                      <input name="away_score" type="number" min={0}
                        defaultValue={m.away_score ?? ""}
                        className="w-14 rounded border px-2 py-1" />
                    </span>
                  </label>
                  <label className="text-xs">
                    <span className="block text-neutral-500">1. třetina</span>
                    <span className="flex items-center gap-1">
                      <input name="home_score_p1" type="number" min={0}
                        defaultValue={m.home_score_p1 ?? ""}
                        className="w-14 rounded border px-2 py-1" />
                      :
                      <input name="away_score_p1" type="number" min={0}
                        defaultValue={m.away_score_p1 ?? ""}
                        className="w-14 rounded border px-2 py-1" />
                    </span>
                  </label>
                  <label className="flex items-center gap-1 text-xs">
                    <input type="checkbox" name="finalized" defaultChecked={m.finalized} />
                    Finalizovat (spočítat body)
                  </label>
                  <button className="rounded bg-neutral-900 px-2 py-1 text-xs text-white">
                    Uložit
                  </button>
                </form>
              </div>
            </article>
          );
        })}
      </div>
    </main>
  );
}
