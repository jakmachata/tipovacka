import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { formatPraguePretty } from "@/lib/tz";

type Status = "Ne" | "Netipující" | "Tipující";

function statusOf(p: { is_approved: boolean; is_player: boolean }): Status {
  if (!p.is_approved) return "Ne";
  return p.is_player ? "Tipující" : "Netipující";
}

const ORDER: Status[] = ["Ne", "Netipující", "Tipující"];

const STATUS_CLS: Record<Status, string> = {
  Ne: "bg-neutral-100 text-neutral-600",
  Netipující: "bg-sky-100 text-sky-800",
  Tipující: "bg-emerald-100 text-emerald-800",
};

function relativeFromNow(iso: string | null | undefined): string {
  if (!iso) return "—";
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return "—";
  const diffSec = Math.round((Date.now() - ts) / 1000);
  if (diffSec < 60) return `před ${diffSec}s`;
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `před ${diffMin} min`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `před ${diffHr} h`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 30) return `před ${diffDay} dny`;
  return formatPraguePretty(iso);
}

export default async function AdminUsersPage() {
  const supabase = await createClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .order("is_admin", { ascending: false })
    .order("created_at", { ascending: false });

  async function cycleStatus(formData: FormData) {
    "use server";
    const sb = await createClient();
    const id = String(formData.get("id"));
    const current = String(formData.get("current")) as Status;
    const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length];
    const fields =
      next === "Ne"
        ? { is_approved: false, is_player: false }
        : next === "Netipující"
          ? { is_approved: true, is_player: false }
          : { is_approved: true, is_player: true };
    await sb.from("profiles").update(fields).eq("id", id);
    revalidatePath("/admin/users");
    revalidatePath("/schedule");
  }

  async function togglePaid(formData: FormData) {
    "use server";
    const sb = await createClient();
    const id = String(formData.get("id"));
    const value = formData.get("value") === "true";
    await sb.from("profiles").update({ has_paid: value }).eq("id", id);
    revalidatePath("/admin/users");
  }

  return (
    <main>
      <h1 className="mb-4 text-xl font-semibold">Hráči</h1>
      <p className="mb-3 text-sm text-neutral-600">
        Klikni na status pro cyklický přepínač:{" "}
        <span className="rounded bg-neutral-100 px-1.5 py-0.5">Ne</span> →{" "}
        <span className="rounded bg-sky-100 px-1.5 py-0.5 text-sky-800">
          Netipující
        </span>{" "}
        (vidí, ale nemá sloupec) →{" "}
        <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-800">
          Tipující
        </span>{" "}
        (má sloupec, tipuje) → Ne…
      </p>

      <table className="w-full text-sm">
        <thead className="border-b text-left text-neutral-500">
          <tr>
            <th className="py-2">Přezdívka</th>
            <th>Status</th>
            <th>Zaplatil</th>
            <th>Naposledy viděn</th>
            <th>Admin</th>
          </tr>
        </thead>
        <tbody>
          {(profiles ?? []).map((p: any) => {
            const s = statusOf(p);
            return (
              <tr key={p.id} className="border-b">
                <td className="py-2 font-medium">{p.display_name}</td>
                <td>
                  {p.is_admin ? (
                    <span className="rounded bg-amber-100 px-2 py-1 text-amber-800">
                      Admin
                    </span>
                  ) : (
                    <form action={cycleStatus} className="inline">
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="current" value={s} />
                      <button className={"rounded px-2 py-1 " + STATUS_CLS[s]}>
                        {s}
                      </button>
                    </form>
                  )}
                </td>
                <td>
                  <form action={togglePaid} className="inline">
                    <input type="hidden" name="id" value={p.id} />
                    <input
                      type="hidden"
                      name="value"
                      value={(!p.has_paid).toString()}
                    />
                    <button
                      className={
                        p.has_paid
                          ? "rounded bg-emerald-100 px-2 py-1 text-emerald-800"
                          : "rounded bg-neutral-100 px-2 py-1 text-neutral-600"
                      }
                    >
                      {p.has_paid ? "✓ ano" : "— ne"}
                    </button>
                  </form>
                </td>
                <td
                  className="text-neutral-500"
                  title={p.last_seen_at ? formatPraguePretty(p.last_seen_at) : ""}
                >
                  {relativeFromNow(p.last_seen_at)}
                </td>
                <td className="text-neutral-500">{p.is_admin ? "✓" : ""}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </main>
  );
}
