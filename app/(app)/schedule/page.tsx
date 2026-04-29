import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { STAGE_LABEL, type Match, type Pick, type Team } from "@/lib/types";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("cs-CZ", {
    weekday: "short", day: "numeric", month: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function teamLabel(t: Team | undefined, hcp: number | null, isHome: boolean) {
  if (!t) return "?";
  // domácí ukazují hcp tak, jak je v DB; hosté inverzi
  const v = hcp == null ? null : (isHome ? hcp : -hcp);
  const sign = v === null ? "" : v > 0 ? `+${v}` : `${v}`;
  return `${t.flag_emoji ?? ""} ${t.name_cs}${v === null ? "" : ` (${sign})`}`;
}

export default async function SchedulePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: matches }, { data: teams }, { data: myPicks }] = await Promise.all([
    supabase.from("matches").select("*").order("starts_at"),
    supabase.from("teams").select("*"),
    supabase.from("picks").select("*").eq("user_id", user!.id),
  ]);

  const teamMap = new Map((teams ?? []).map((t) => [t.code, t as Team]));
  const pickMap = new Map((myPicks ?? []).map((p) => [p.match_id, p as Pick]));
  const now = Date.now();

  async function savePick(formData: FormData) {
    "use server";
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;

    const match_id = Number(formData.get("match_id"));
    const home_score = Number(formData.get("home_score"));
    const away_score = Number(formData.get("away_score"));
    const hp1 = formData.get("home_score_p1");
    const ap1 = formData.get("away_score_p1");
    const home_score_p1 = hp1 === "" || hp1 == null ? null : Number(hp1);
    const away_score_p1 = ap1 === "" || ap1 == null ? null : Number(ap1);

    await sb.from("picks").upsert({
      user_id: user.id,
      match_id,
      home_score,
      away_score,
      home_score_p1,
      away_score_p1,
    });
    revalidatePath("/schedule");
  }

  return (
    <main>
      <h1 className="mb-6 text-2xl font-semibold">Zápasy</h1>
      <p className="mb-6 text-sm text-neutral-600">
        Vyplň skóre po 60. min — handicap se odvodí automaticky. Skóre po 1. třetině je
        nepovinné a nese +1 bod, jen pokud trefíš přesný výsledek.
      </p>

      <div className="space-y-4">
        {(matches ?? []).map((m) => {
          const match = m as Match;
          const home = teamMap.get(match.home_code);
          const away = teamMap.get(match.away_code);
          const pick = pickMap.get(match.id);
          const started = new Date(match.starts_at).getTime() <= now;

          return (
            <article key={match.id} className="rounded-lg border bg-white p-4">
              <header className="flex items-start justify-between text-sm text-neutral-600">
                <div>
                  <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs">
                    {STAGE_LABEL[match.stage]}
                  </span>{" "}
                  <span>{formatDateTime(match.starts_at)}</span>
                </div>
                {match.finalized && (
                  <span className="font-semibold text-neutral-900">
                    {match.home_score}:{match.away_score}
                    {match.home_score_p1 != null && (
                      <span className="ml-2 text-xs text-neutral-500">
                        (1. třetina {match.home_score_p1}:{match.away_score_p1})
                      </span>
                    )}
                  </span>
                )}
              </header>

              <div className="mt-2 grid grid-cols-3 items-center gap-2">
                <div className="font-medium">{teamLabel(home, match.home_handicap, true)}</div>
                <div className="text-center text-neutral-400">vs</div>
                <div className="text-right font-medium">{teamLabel(away, match.home_handicap, false)}</div>
              </div>

              {!started ? (
                <form action={savePick} className="mt-3 flex flex-wrap items-end gap-2">
                  <input type="hidden" name="match_id" value={match.id} />
                  <label className="text-xs">
                    <span className="block text-neutral-500">Skóre 60′</span>
                    <span className="flex items-center gap-1">
                      <input
                        name="home_score" type="number" min={0} required
                        defaultValue={pick?.home_score ?? ""}
                        className="w-14 rounded border px-2 py-1"
                      />
                      :
                      <input
                        name="away_score" type="number" min={0} required
                        defaultValue={pick?.away_score ?? ""}
                        className="w-14 rounded border px-2 py-1"
                      />
                    </span>
                  </label>
                  <label className="text-xs">
                    <span className="block text-neutral-500">Skóre po 1. třetině (nepovinné)</span>
                    <span className="flex items-center gap-1">
                      <input
                        name="home_score_p1" type="number" min={0}
                        defaultValue={pick?.home_score_p1 ?? ""}
                        className="w-14 rounded border px-2 py-1"
                      />
                      :
                      <input
                        name="away_score_p1" type="number" min={0}
                        defaultValue={pick?.away_score_p1 ?? ""}
                        className="w-14 rounded border px-2 py-1"
                      />
                    </span>
                  </label>
                  <button className="rounded bg-black px-3 py-1.5 text-sm text-white">
                    Uložit tip
                  </button>
                </form>
              ) : (
                <div className="mt-3 text-sm text-neutral-600">
                  Tvůj tip:{" "}
                  {pick ? (
                    <strong>
                      {pick.home_score}:{pick.away_score}
                      {pick.home_score_p1 != null && (
                        <span className="ml-1 text-xs text-neutral-500">
                          (1. třetina {pick.home_score_p1}:{pick.away_score_p1})
                        </span>
                      )}
                    </strong>
                  ) : (
                    <em>nezadán</em>
                  )}
                  <a href={`/matches/${match.id}`} className="ml-3 underline">
                    Zobrazit ostatní tipy →
                  </a>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </main>
  );
}
