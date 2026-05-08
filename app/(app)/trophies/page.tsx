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
  const r = points / ideal;
  // Procentem s jedním desetinným místem.
  return (r * 100).toFixed(1) + " %";
}

export default async function TrophiesPage() {
  const supabase = await createClient();
  const { data: trophies } = await supabase
    .from("trophies")
    .select("*")
    .order("display_order", { ascending: true })
    .order("id", { ascending: true });

  const list = (trophies ?? []) as Trophy[];

  return (
    <main>
      <h1 className="mb-2 text-2xl font-bold">Trophy room</h1>
      <p className="mb-2 text-sm text-neutral-600">
        ...aneb historie naší letité tipovačky...
      </p>
      <p className="mb-6 text-xs text-neutral-500">
        DIR (Daily&apos;s Ideal Rate) ukazuje, jak blízko byl hráč optimálnímu
        zisku za turnaj. <strong>DIR1</strong> = počet bodů ÷ součet nejvyšších
        tipů na zápas. <strong>DIR2</strong> = počet bodů ÷ součet druhých
        nejvyšších tipů na zápas. Pokud Daily&apos;s ideal pro turnaj nebyl
        dopočítán, zůstává buňka prázdná.
      </p>

      {list.length === 0 ? (
        <p className="text-sm text-neutral-500">
          Zatím tu nic není. Master to brzy doplní.
        </p>
      ) : (
        <ul className="space-y-6">
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
              <li key={t.id} className="rounded-lg border p-4">
                <div className="mb-3 text-lg font-semibold">{t.event_name}</div>

                {rows.length === 0 ? (
                  <p className="text-sm text-neutral-500">
                    Zatím bez výsledků.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs uppercase text-neutral-500">
                          <th className="w-10 px-2 py-1"></th>
                          <th className="px-2 py-1">Jméno</th>
                          <th className="px-2 py-1 text-right">Body</th>
                          <th className="px-2 py-1 text-right">DIR1</th>
                          <th className="px-2 py-1 text-right">DIR2</th>
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

                {(t.daily_ideal_1 != null || t.daily_ideal_2 != null) && (
                  <p className="mt-2 text-[11px] text-neutral-500">
                    Daily&apos;s ideal:{" "}
                    {t.daily_ideal_1 != null
                      ? `#1 = ${t.daily_ideal_1}`
                      : "#1 —"}
                    {", "}
                    {t.daily_ideal_2 != null
                      ? `#2 = ${t.daily_ideal_2}`
                      : "#2 —"}
                  </p>
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
