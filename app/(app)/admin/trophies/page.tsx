import { revalidatePath } from "next/cache";
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

export default async function AdminTrophiesPage() {
  const supabase = await createClient();
  const { data: trophies } = await supabase
    .from("trophies")
    .select("*")
    .order("year", { ascending: false })
    .order("id", { ascending: false });

  const list = (trophies ?? []) as Trophy[];

  async function addTrophy(formData: FormData) {
    "use server";
    const sb = await createClient();
    const year = Number(formData.get("year") ?? 0);
    const event_name = String(formData.get("event_name") ?? "").trim();
    const gold = String(formData.get("gold") ?? "").trim() || null;
    const silver = String(formData.get("silver") ?? "").trim() || null;
    const bronze = String(formData.get("bronze") ?? "").trim() || null;
    const notes = String(formData.get("notes") ?? "").trim() || null;
    if (!event_name || !year) return;
    await sb
      .from("trophies")
      .insert({ year, event_name, gold, silver, bronze, notes });
    revalidatePath("/trophies");
    revalidatePath("/admin/trophies");
  }

  async function deleteTrophy(formData: FormData) {
    "use server";
    const sb = await createClient();
    const id = Number(formData.get("id"));
    if (!id) return;
    await sb.from("trophies").delete().eq("id", id);
    revalidatePath("/trophies");
    revalidatePath("/admin/trophies");
  }

  const thisYear = new Date().getFullYear();

  return (
    <main>
      <h1 className="mb-4 text-xl font-semibold">🏆 Trophy room — editace</h1>

      <section className="mb-8 rounded-lg border p-4">
        <h2 className="mb-3 text-sm font-semibold text-neutral-700">
          Přidat záznam
        </h2>
        <form action={addTrophy} className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="text-sm">
            <span className="block text-xs text-neutral-500">Rok</span>
            <input
              name="year"
              type="number"
              defaultValue={thisYear}
              required
              className="w-full rounded border px-2 py-1.5 text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="block text-xs text-neutral-500">Název soutěže</span>
            <input
              name="event_name"
              type="text"
              placeholder="MS 2026, Olympiáda 2026, …"
              required
              className="w-full rounded border px-2 py-1.5 text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="block text-xs text-neutral-500">🥇 Vítěz</span>
            <input
              name="gold"
              type="text"
              className="w-full rounded border px-2 py-1.5 text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="block text-xs text-neutral-500">🥈 Druhé místo</span>
            <input
              name="silver"
              type="text"
              className="w-full rounded border px-2 py-1.5 text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="block text-xs text-neutral-500">🥉 Třetí místo</span>
            <input
              name="bronze"
              type="text"
              className="w-full rounded border px-2 py-1.5 text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="block text-xs text-neutral-500">Poznámka (volitelné)</span>
            <input
              name="notes"
              type="text"
              className="w-full rounded border px-2 py-1.5 text-sm"
            />
          </label>
          <div className="md:col-span-2">
            <button
              type="submit"
              className="rounded bg-black px-4 py-2 text-sm text-white hover:bg-neutral-800"
            >
              Přidat
            </button>
          </div>
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-neutral-700">
          Existující záznamy ({list.length})
        </h2>
        {list.length === 0 ? (
          <p className="text-sm text-neutral-500">Zatím žádné záznamy.</p>
        ) : (
          <ul className="space-y-2">
            {list.map((t) => (
              <li
                key={t.id}
                className="flex items-start justify-between gap-3 rounded border p-3 text-sm"
              >
                <div className="flex-1">
                  <div className="font-semibold">
                    {t.event_name} <span className="text-neutral-500">{t.year}</span>
                  </div>
                  <div className="mt-1 space-x-3 text-xs text-neutral-600">
                    {t.gold && <span>🥇 {t.gold}</span>}
                    {t.silver && <span>🥈 {t.silver}</span>}
                    {t.bronze && <span>🥉 {t.bronze}</span>}
                  </div>
                  {t.notes && (
                    <div className="mt-1 text-xs text-neutral-500">{t.notes}</div>
                  )}
                </div>
                <form action={deleteTrophy}>
                  <input type="hidden" name="id" value={t.id} />
                  <button
                    title="Smazat záznam"
                    className="rounded bg-rose-100 px-2 py-1 text-xs text-rose-700 hover:bg-rose-200"
                  >
                    🗑️ Smazat
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
