import { revalidatePath } from "next/cache";
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

function parsePts(v: FormDataEntryValue | null): number | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export default async function AdminTrophiesPage() {
  const supabase = await createClient();
  const { data: trophies } = await supabase
    .from("trophies")
    .select("*")
    .order("id", { ascending: false });

  const list = (trophies ?? []) as Trophy[];

  async function addTrophy(formData: FormData) {
    "use server";
    const sb = await createClient();
    const event_name = String(formData.get("event_name") ?? "").trim();
    const gold = String(formData.get("gold") ?? "").trim() || null;
    const silver = String(formData.get("silver") ?? "").trim() || null;
    const bronze = String(formData.get("bronze") ?? "").trim() || null;
    const gold_points = parsePts(formData.get("gold_points"));
    const silver_points = parsePts(formData.get("silver_points"));
    const bronze_points = parsePts(formData.get("bronze_points"));
    const notes = String(formData.get("notes") ?? "").trim() || null;
    if (!event_name) return;
    await sb.from("trophies").insert({
      event_name,
      gold,
      silver,
      bronze,
      gold_points,
      silver_points,
      bronze_points,
      notes,
    });
    revalidatePath("/trophies");
    revalidatePath("/admin/trophies");
  }

  async function updateTrophy(formData: FormData) {
    "use server";
    const sb = await createClient();
    const id = Number(formData.get("id"));
    const event_name = String(formData.get("event_name") ?? "").trim();
    const gold = String(formData.get("gold") ?? "").trim() || null;
    const silver = String(formData.get("silver") ?? "").trim() || null;
    const bronze = String(formData.get("bronze") ?? "").trim() || null;
    const gold_points = parsePts(formData.get("gold_points"));
    const silver_points = parsePts(formData.get("silver_points"));
    const bronze_points = parsePts(formData.get("bronze_points"));
    const notes = String(formData.get("notes") ?? "").trim() || null;
    if (!id || !event_name) return;
    await sb
      .from("trophies")
      .update({
        event_name,
        gold,
        silver,
        bronze,
        gold_points,
        silver_points,
        bronze_points,
        notes,
      })
      .eq("id", id);
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

  return (
    <main>
      <h1 className="mb-4 text-xl font-semibold">Trophy room — editace</h1>

      <section className="mb-8 rounded-lg border p-4">
        <h2 className="mb-3 text-sm font-semibold text-neutral-700">
          Přidat záznam
        </h2>
        <form
          action={addTrophy}
          className="grid grid-cols-1 gap-3 md:grid-cols-2"
        >
          <label className="text-sm md:col-span-2">
            <span className="block text-xs text-neutral-500">
              Název soutěže
            </span>
            <input
              name="event_name"
              type="text"
              placeholder="MS 2026, Olympiáda 2026, …"
              required
              className="w-full rounded border px-2 py-1.5 text-sm"
            />
          </label>

          <label className="text-sm">
            <span className="block text-xs text-neutral-500">Vítěz</span>
            <input
              name="gold"
              type="text"
              className="w-full rounded border px-2 py-1.5 text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="block text-xs text-neutral-500">Body vítěze</span>
            <input
              name="gold_points"
              type="number"
              inputMode="numeric"
              className="w-full rounded border px-2 py-1.5 text-sm"
            />
          </label>

          <label className="text-sm">
            <span className="block text-xs text-neutral-500">Druhé místo</span>
            <input
              name="silver"
              type="text"
              className="w-full rounded border px-2 py-1.5 text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="block text-xs text-neutral-500">
              Body druhého
            </span>
            <input
              name="silver_points"
              type="number"
              inputMode="numeric"
              className="w-full rounded border px-2 py-1.5 text-sm"
            />
          </label>

          <label className="text-sm">
            <span className="block text-xs text-neutral-500">Třetí místo</span>
            <input
              name="bronze"
              type="text"
              className="w-full rounded border px-2 py-1.5 text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="block text-xs text-neutral-500">
              Body třetího
            </span>
            <input
              name="bronze_points"
              type="number"
              inputMode="numeric"
              className="w-full rounded border px-2 py-1.5 text-sm"
            />
          </label>

          <label className="text-sm md:col-span-2">
            <span className="block text-xs text-neutral-500">
              Poznámka (volitelné)
            </span>
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
              <li key={t.id} className="rounded border p-3 text-sm">
                <details>
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                    <div className="flex-1">
                      <div className="font-semibold">{t.event_name}</div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-neutral-600">
                        {t.gold && (
                          <span>1. {fmt(t.gold, t.gold_points)}</span>
                        )}
                        {t.silver && (
                          <span>2. {fmt(t.silver, t.silver_points)}</span>
                        )}
                        {t.bronze && (
                          <span>3. {fmt(t.bronze, t.bronze_points)}</span>
                        )}
                      </div>
                      {t.notes && (
                        <div className="mt-1 text-xs text-neutral-500">
                          {t.notes}
                        </div>
                      )}
                    </div>
                    <span className="rounded bg-neutral-100 px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-200">
                      Upravit
                    </span>
                  </summary>

                  <form
                    action={updateTrophy}
                    className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2"
                  >
                    <input type="hidden" name="id" value={t.id} />
                    <label className="text-sm md:col-span-2">
                      <span className="block text-xs text-neutral-500">
                        Název soutěže
                      </span>
                      <input
                        name="event_name"
                        type="text"
                        defaultValue={t.event_name}
                        required
                        className="w-full rounded border px-2 py-1.5 text-sm"
                      />
                    </label>

                    <label className="text-sm">
                      <span className="block text-xs text-neutral-500">
                        Vítěz
                      </span>
                      <input
                        name="gold"
                        type="text"
                        defaultValue={t.gold ?? ""}
                        className="w-full rounded border px-2 py-1.5 text-sm"
                      />
                    </label>
                    <label className="text-sm">
                      <span className="block text-xs text-neutral-500">
                        Body vítěze
                      </span>
                      <input
                        name="gold_points"
                        type="number"
                        inputMode="numeric"
                        defaultValue={t.gold_points ?? ""}
                        className="w-full rounded border px-2 py-1.5 text-sm"
                      />
                    </label>

                    <label className="text-sm">
                      <span className="block text-xs text-neutral-500">
                        Druhé místo
                      </span>
                      <input
                        name="silver"
                        type="text"
                        defaultValue={t.silver ?? ""}
                        className="w-full rounded border px-2 py-1.5 text-sm"
                      />
                    </label>
                    <label className="text-sm">
                      <span className="block text-xs text-neutral-500">
                        Body druhého
                      </span>
                      <input
                        name="silver_points"
                        type="number"
                        inputMode="numeric"
                        defaultValue={t.silver_points ?? ""}
                        className="w-full rounded border px-2 py-1.5 text-sm"
                      />
                    </label>

                    <label className="text-sm">
                      <span className="block text-xs text-neutral-500">
                        Třetí místo
                      </span>
                      <input
                        name="bronze"
                        type="text"
                        defaultValue={t.bronze ?? ""}
                        className="w-full rounded border px-2 py-1.5 text-sm"
                      />
                    </label>
                    <label className="text-sm">
                      <span className="block text-xs text-neutral-500">
                        Body třetího
                      </span>
                      <input
                        name="bronze_points"
                        type="number"
                        inputMode="numeric"
                        defaultValue={t.bronze_points ?? ""}
                        className="w-full rounded border px-2 py-1.5 text-sm"
                      />
                    </label>

                    <label className="text-sm md:col-span-2">
                      <span className="block text-xs text-neutral-500">
                        Poznámka
                      </span>
                      <input
                        name="notes"
                        type="text"
                        defaultValue={t.notes ?? ""}
                        className="w-full rounded border px-2 py-1.5 text-sm"
                      />
                    </label>

                    <div className="flex gap-2 md:col-span-2">
                      <button
                        type="submit"
                        className="rounded bg-black px-4 py-2 text-sm text-white hover:bg-neutral-800"
                      >
                        Uložit změny
                      </button>
                    </div>
                  </form>

                  <form action={deleteTrophy} className="mt-3">
                    <input type="hidden" name="id" value={t.id} />
                    <button
                      title="Smazat záznam"
                      className="rounded bg-rose-100 px-2 py-1 text-xs text-rose-700 hover:bg-rose-200"
                    >
                      Smazat záznam
                    </button>
                  </form>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
