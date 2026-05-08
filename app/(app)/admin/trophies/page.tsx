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
  daily_ideal_1: number | null;
  daily_ideal_2: number | null;
  display_order: number | null;
  notes: string | null;
}

function fmt(name: string | null, points: number | null) {
  if (!name) return null;
  if (points == null) return name;
  return `${name} (${points} b.)`;
}

function parseNum(v: FormDataEntryValue | null): number | null {
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
    .order("display_order", { ascending: true })
    .order("id", { ascending: true });

  const list = (trophies ?? []) as Trophy[];

  async function addTrophy(formData: FormData) {
    "use server";
    const sb = await createClient();
    const event_name = String(formData.get("event_name") ?? "").trim();
    const gold = String(formData.get("gold") ?? "").trim() || null;
    const silver = String(formData.get("silver") ?? "").trim() || null;
    const bronze = String(formData.get("bronze") ?? "").trim() || null;
    const gold_points = parseNum(formData.get("gold_points"));
    const silver_points = parseNum(formData.get("silver_points"));
    const bronze_points = parseNum(formData.get("bronze_points"));
    const daily_ideal_1 = parseNum(formData.get("daily_ideal_1"));
    const daily_ideal_2 = parseNum(formData.get("daily_ideal_2"));
    const notes = String(formData.get("notes") ?? "").trim() || null;
    if (!event_name) return;

    // Nový záznam padá dozadu — display_order = MAX(display_order) + 1.
    const { data: maxRow } = await sb
      .from("trophies")
      .select("display_order")
      .order("display_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextOrder =
      maxRow && typeof maxRow.display_order === "number"
        ? maxRow.display_order + 1
        : 1;

    await sb.from("trophies").insert({
      event_name,
      gold,
      silver,
      bronze,
      gold_points,
      silver_points,
      bronze_points,
      daily_ideal_1,
      daily_ideal_2,
      notes,
      display_order: nextOrder,
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
    const gold_points = parseNum(formData.get("gold_points"));
    const silver_points = parseNum(formData.get("silver_points"));
    const bronze_points = parseNum(formData.get("bronze_points"));
    const daily_ideal_1 = parseNum(formData.get("daily_ideal_1"));
    const daily_ideal_2 = parseNum(formData.get("daily_ideal_2"));
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
        daily_ideal_1,
        daily_ideal_2,
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

  // Posun záznamu nahoru / dolů: prohodíme display_order se sousedem.
  async function moveTrophy(formData: FormData) {
    "use server";
    const sb = await createClient();
    const id = Number(formData.get("id"));
    const direction = String(formData.get("direction") ?? "");
    if (!id || (direction !== "up" && direction !== "down")) return;

    const { data: meRow } = await sb
      .from("trophies")
      .select("id, display_order")
      .eq("id", id)
      .maybeSingle();
    if (!meRow || meRow.display_order == null) return;

    const ascending = direction === "down"; // hledáme následující (větší order)
    let neighborQuery = sb
      .from("trophies")
      .select("id, display_order")
      .order("display_order", { ascending })
      .order("id", { ascending })
      .limit(1);
    if (ascending) {
      neighborQuery = neighborQuery.gt("display_order", meRow.display_order);
    } else {
      neighborQuery = neighborQuery.lt("display_order", meRow.display_order);
    }
    const { data: neighborRow } = await neighborQuery.maybeSingle();
    if (!neighborRow || neighborRow.display_order == null) return;

    // Prohodit hodnoty. Použijeme dočasný offset, ať se nezasekne unique
    // (i když na display_order není unique, je to bezpečnější).
    const tmpOrder = -Math.abs(meRow.id) - 1;
    await sb
      .from("trophies")
      .update({ display_order: tmpOrder })
      .eq("id", meRow.id);
    await sb
      .from("trophies")
      .update({ display_order: meRow.display_order })
      .eq("id", neighborRow.id);
    await sb
      .from("trophies")
      .update({ display_order: neighborRow.display_order })
      .eq("id", meRow.id);

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
        <p className="mb-3 text-xs text-neutral-500">
          Daily&apos;s ideal #1 = součet nejvyšších tipů (po zápasech), Daily&apos;s
          ideal #2 = součet druhých nejvyšších tipů. Slouží pro výpočet DIR1 /
          DIR2 v Trophy roomu.
        </p>
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

          <label className="text-sm">
            <span className="block text-xs text-neutral-500">
              Daily&apos;s ideal #1
            </span>
            <input
              name="daily_ideal_1"
              type="number"
              inputMode="decimal"
              step="0.01"
              className="w-full rounded border px-2 py-1.5 text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="block text-xs text-neutral-500">
              Daily&apos;s ideal #2
            </span>
            <input
              name="daily_ideal_2"
              type="number"
              inputMode="decimal"
              step="0.01"
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
            {list.map((t, idx) => (
              <li key={t.id} className="rounded border p-3 text-sm">
                <details>
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                    <div className="flex flex-col items-center gap-1">
                      <form action={moveTrophy}>
                        <input type="hidden" name="id" value={t.id} />
                        <input type="hidden" name="direction" value="up" />
                        <button
                          type="submit"
                          disabled={idx === 0}
                          title="Posunout nahoru"
                          aria-label="Posunout nahoru"
                          className="rounded border px-1.5 py-0.5 text-xs text-neutral-600 hover:bg-neutral-100 disabled:opacity-30"
                        >
                          ▲
                        </button>
                      </form>
                      <form action={moveTrophy}>
                        <input type="hidden" name="id" value={t.id} />
                        <input type="hidden" name="direction" value="down" />
                        <button
                          type="submit"
                          disabled={idx === list.length - 1}
                          title="Posunout dolů"
                          aria-label="Posunout dolů"
                          className="rounded border px-1.5 py-0.5 text-xs text-neutral-600 hover:bg-neutral-100 disabled:opacity-30"
                        >
                          ▼
                        </button>
                      </form>
                    </div>
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
                      {(t.daily_ideal_1 != null || t.daily_ideal_2 != null) && (
                        <div className="mt-1 text-xs text-neutral-500">
                          Daily&apos;s ideals:{" "}
                          {t.daily_ideal_1 != null
                            ? `#1 = ${t.daily_ideal_1}`
                            : "#1 —"}
                          {", "}
                          {t.daily_ideal_2 != null
                            ? `#2 = ${t.daily_ideal_2}`
                            : "#2 —"}
                        </div>
                      )}
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

                    <label className="text-sm">
                      <span className="block text-xs text-neutral-500">
                        Daily&apos;s ideal #1
                      </span>
                      <input
                        name="daily_ideal_1"
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        defaultValue={t.daily_ideal_1 ?? ""}
                        className="w-full rounded border px-2 py-1.5 text-sm"
                      />
                    </label>
                    <label className="text-sm">
                      <span className="block text-xs text-neutral-500">
                        Daily&apos;s ideal #2
                      </span>
                      <input
                        name="daily_ideal_2"
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        defaultValue={t.daily_ideal_2 ?? ""}
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
