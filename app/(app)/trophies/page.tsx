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
  notes: string | null;
}

export default async function TrophiesPage() {
  const supabase = await createClient();
  const { data: trophies } = await supabase
    .from("trophies")
    .select("*")
    .order("id", { ascending: false });

  const list = (trophies ?? []) as Trophy[];

  return (
    <main>
      <h1 className="mb-2 text-2xl font-bold">Trophy room</h1>
      <p className="mb-6 text-sm text-neutral-600">
        ...aneb historie naší letité tipovačky...
      </p>

      {list.length === 0 ? (
        <p className="text-sm text-neutral-500">
          Zatím tu nic není. Master to brzy doplní.
        </p>
      ) : (
        <ul className="space-y-4">
          {list.map((t) => (
            <li key={t.id} className="rounded-lg border p-4">
              <div className="mb-2 text-lg font-semibold">{t.event_name}</div>
              <div className="space-y-1 text-sm">
                {t.gold && (
                  <div className="flex items-baseline gap-2">
                    <span>🥇</span>
                    <span className="font-semibold">{t.gold}</span>
                    {t.gold_points != null && (
                      <span className="text-xs text-neutral-500">
                        ({t.gold_points} bodů)
                      </span>
                    )}
                  </div>
                )}
                {t.silver && (
                  <div className="flex items-baseline gap-2">
                    <span>🥈</span>
                    <span>{t.silver}</span>
                    {t.silver_points != null && (
                      <span className="text-xs text-neutral-500">
                        ({t.silver_points} bodů)
                      </span>
                    )}
                  </div>
                )}
                {t.bronze && (
                  <div className="flex items-baseline gap-2">
                    <span>🥉</span>
                    <span>{t.bronze}</span>
                    {t.bronze_points != null && (
                      <span className="text-xs text-neutral-500">
                        ({t.bronze_points} bodů)
                      </span>
                    )}
                  </div>
                )}
              </div>
              {t.notes && (
                <p className="mt-2 text-xs text-neutral-500">{t.notes}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
