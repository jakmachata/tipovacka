import { createClient } from "@/lib/supabase/server";

interface Trophy {
  id: number;
  event_name: string;
  gold: string | null;
  silver: string | null;
  bronze: string | null;
  gold_points: number | null;
  silver_points: number | null;
  bronze_points: number | null;
  daily_ideal_1: number | null;
  daily_ideal_2: number | null;
  display_order: number | null;
  notes: string | null;
}

function dir(points: number | null, ideal: number | null): string {
  if (points == null || ideal == null || ideal === 0) return "";
  // Procentem (bez jednotky), 1 desetinné místo. Symbol % je v hlavičce sloupce.
  return ((points / ideal) * 100).toFixed(1);
}

export default async function TrophiesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let isAdmin = false;
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
    isAdmin = !!profile?.is_admin;
  }
  const { data: trophies } = await supabase
    .from("trophies")
    .select("*")
    .order("display_order", { ascending: true })
    .order("id", { ascending: true });

  const list = (trophies ?? []) as Trophy[];

  return (
    <main>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Trophy room</h1>
        {isAdmin && (
          <a href="/admin/trophies" className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-50">
            Upravit
          </a>
        )}
      </div>
      <p className="mb-2 text-sm text-neutral-600">
        ...aneb historie naší letité tipovačky...
      </p>
      <p className="mb-6 text-xs text-neutral-500">
        DIR (Daily&apos;s Ideal Rate) tu je od toho, aby ukázal nějakou
        stabilní metriku mezi turnaji s různými pravidly bodování. Ukazuje,
        jak blízko byl hráč optimálnímu bodovému zisku:{" "}
        <strong>DIR1</strong> je součet nejvyšších zisků z každého zápasu;{" "}
        <strong>DIR2</strong> je druhý nejvyšší.
      </p>

      {list.length === 0 ? (
        <p className="text-sm text-neutral-500">
          Zatím tu nic není. Kuba to brzy doplní.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {list.map((t) => {
            const rows: Array<{
              medal: string;
              name: string | null;
              points: number | null;
            }> = [
              { medal: "🥇", name: t.gold, points: t.gold_points },
              { medal: "🥈", name: t.silver, points: t.silver_points },
              { medal: "🥉", name: t.bronze, points: t.bronze_points },
            ].filter((r) => r.name);

            return (
              <li
                key={t.id}
                className="w-full max-w-[456px] rounded-lg border p-4"
              >
                {rows.length === 0 ? (
                  <>
                    <div className="mb-2 text-lg font-semibold">
                      {t.event_name}
                    </div>
                    <p className="text-sm text-neutral-500">
                      Zatím bez výsledků.
                    </p>
                  </>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="text-sm">
                      <colgroup>
                        <col style={{ width: 40 }} />
                        <col style={{ width: 170 }} />
                        <col style={{ width: 40 }} />
                        <col style={{ width: 68 }} />
                        <col style={{ width: 68 }} />
                      </colgroup>
                      <thead>
                        <tr className="text-left">
                          <th className="px-2 py-1"></th>
                          <th className="px-2 py-1 text-base font-semibold text-neutral-900">
                            {t.event_name}
                          </th>
                          <th className="px-2 py-1 text-right text-xs uppercase text-neutral-500">
                            Body
                          </th>
                          <th className="px-2 py-1 text-right text-xs uppercase text-neutral-500">
                            DIR1 %
                          </th>
                          <th className="px-2 py-1 text-right text-xs uppercase text-neutral-500">
                            DIR2 %
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r) => (
                          <tr key={r.medal} className="border-t">
                            <td className="px-2 py-1 text-lg">{r.medal}</td>
                            <td className="px-2 py-1 font-medium">{r.name}</td>
                            <td className="px-2 py-1 text-right tabular-nums">
                              {r.points ?? ""}
                            </td>
                            <td className="px-2 py-1 text-right tabular-nums text-neutral-700">
                              {dir(r.points, t.daily_ideal_1)}
                            </td>
                            <td className="px-2 py-1 text-right tabular-nums text-neutral-700">
                              {dir(r.points, t.daily_ideal_2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {t.notes && (
                  <p className="mt-2 text-xs text-neutral-500">{t.notes}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
