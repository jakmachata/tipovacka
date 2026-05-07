import { createClient } from "@/lib/supabase/server";

interface Trophy {
  id: number;
  year: number;
  event_name: string;
  gold: string | null;
  silver: string | null;
  bronze: string | null;
  notes: string | null;
}

export default async function TrophiesPage() {
  const supabase = await createClient();
  const { data: trophies } = await supabase
    .from("trophies")
    .select("*")
    .order("year", { ascending: false })
    .order("id", { ascending: false });

  const list = (trophies ?? []) as Trophy[];

  return (
    <main>
      <h1 className="mb-2 text-2xl font-bold">🏆 Trophy room</h1>
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
              <div className="mb-2 flex items-baseline gap-2">
                <span className="text-lg font-semibold">{t.event_name}</span>
                <span className="text-sm text-neutral-500">{t.year}</span>
              </div>
              <div className="space-y-1 text-sm">
                {t.gold && (
                  <div>
                    <span className="mr-2">🥇</span>
                    <span className="font-semibold">{t.gold}</span>
                  </div>
                )}
                {t.silver && (
                  <div>
                    <span className="mr-2">🥈</span>
                    <span>{t.silver}</span>
                  </div>
                )}
                {t.bronze && (
                  <div>
                    <span className="mr-2">🥉</span>
                    <span>{t.bronze}</span>
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
