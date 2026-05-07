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

function fmt(name: string | null, points: number | null) {
  if (!name) return null;
  if (points == null) return name;
  return `${name} (${points} b.)`;
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
        Historie naší tipovačky. Vítěz, stříbrný i bronzový skončili na bedně —
        zbytek prohrál.
      </p>

      {list.length === 0 ? (
        <p className="text-sm text-neutral-500">
          Zatím tu nic není. Master to brzy doplní.
        </p>
      ) : (
        <ul className="space-y-4">
          {list.map((t) => (
            <li key={t.id} className="rounded-lg border p-4">
              <div className="mb-2">
                <span className="text-lg font-semibold">{t.event_name}</span>
              </div>
              <div className="space-y-1 text-sm">
                {t.gold && (
                  <div>
                    <span className="mr-2 inline-block w-4 font-semibold">1.</span>
                    <span className="font-semibold">{fmt(t.gold, t.gold_points)}</span>
                  </div>
                )}
                {t.silver && (
                  <div>
                    <span className="mr-2 inline-block w-4">2.</span>
                    <span>{fmt(t.silver, t.silver_points)}</span>
                  </div>
                )}
                {t.bronze && (
                  <div>
                    <span className="mr-2 inline-block w-4">3.</span>
                    <span>{fmt(t.bronze, t.bronze_points)}</span>
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
