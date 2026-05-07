import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { formatPraguePretty } from "@/lib/tz";

const DUMMY_EMAIL_SUFFIX = "@tipovacka.local";

type Status = "Neschválen" | "Netipující" | "Tipující";

function statusOf(p: { is_approved: boolean; is_player: boolean }): Status {
  if (!p.is_approved) return "Neschválen";
  return p.is_player ? "Tipující" : "Netipující";
}

const ORDER: Status[] = ["Neschválen", "Netipující", "Tipující"];

const STATUS_CLS: Record<Status, string> = {
  Neschválen: "bg-neutral-100 text-neutral-600",
  Netipující: "bg-sky-100 text-sky-800",
  Tipující: "bg-emerald-100 text-emerald-800",
};

function relativeFromNow(iso: string | null | undefined): string {
  if (!iso) return "-";
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return "-";
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

export default async function HraciPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: meProfile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user!.id)
    .single();
  const isAdmin = !!meProfile?.is_admin;

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
      next === "Neschválen"
        ? { is_approved: false, is_player: false }
        : next === "Netipující"
          ? { is_approved: true, is_player: false }
          : { is_approved: true, is_player: true };
    await sb.from("profiles").update(fields).eq("id", id);
    revalidatePath("/hraci");
    revalidatePath("/schedule");
  }

  async function togglePaid(formData: FormData) {
    "use server";
    const sb = await createClient();
    const id = String(formData.get("id"));
    const value = formData.get("value") === "true";
    await sb.from("profiles").update({ has_paid: value }).eq("id", id);
    revalidatePath("/hraci");
  }

  async function updateDisplayName(formData: FormData) {
    "use server";
    const sb = await createClient();
    const id = String(formData.get("id"));
    const name = String(formData.get("display_name") ?? "").trim();
    if (!name) return;
    await sb.from("profiles").update({ display_name: name }).eq("id", id);
    revalidatePath("/hraci");
    revalidatePath("/schedule");
  }

  async function deleteDummy(formData: FormData) {
    "use server";
    // Re-ověř, že volající je admin
    const sb = await createClient();
    const { data: { user: caller } } = await sb.auth.getUser();
    if (!caller) return;
    const { data: callerProfile } = await sb
      .from("profiles")
      .select("is_admin")
      .eq("id", caller.id)
      .single();
    if (!callerProfile?.is_admin) return;

    const id = String(formData.get("id"));
    const email = String(formData.get("email") ?? "").toLowerCase();

    // POJISTKA: smazat lze jen dummy účty
    if (!email.endsWith(DUMMY_EMAIL_SUFFIX)) return;
    if (id === caller.id) return; // sám sebe ne

    // Service-role client → maže auth.users; FK kaskáda smaže profile + picks + ...
    const admin = createServiceClient();
    await admin.auth.admin.deleteUser(id);

    revalidatePath("/hraci");
    revalidatePath("/schedule");
  }

  return (
    <main>
      <h1 className="mb-4 text-xl font-semibold">Hráči</h1>

      <table className="w-full text-sm">
        <thead className="border-b text-left text-neutral-500">
          <tr>
            {isAdmin && (
              <th className="py-2 text-xs font-medium" style={{ width: "180px" }}>
                Email
              </th>
            )}
            <th className="py-2">Přezdívka</th>
            <th>Status</th>
            <th>Zaplatil</th>
            <th>Naposledy viděn</th>
            {isAdmin && <th className="py-2 text-right pr-2">Smazat</th>}
          </tr>
        </thead>
        <tbody>
          {(profiles ?? []).map((p: any) => {
            const s = statusOf(p);
            return (
              <tr key={p.id} className="border-b">
                {isAdmin && (
                  <td
                    className="py-2 text-xs text-neutral-600 truncate"
                    style={{ width: "180px", maxWidth: "180px" }}
                    title={p.email ?? ""}
                  >
                    {p.email ?? "-"}
                  </td>
                )}
                <td className="py-2 font-medium">
                  {isAdmin && !p.is_admin ? (
                    <form action={updateDisplayName} className="inline-flex items-center gap-1">
                      <input type="hidden" name="id" value={p.id} />
                      <input
                        name="display_name"
                        defaultValue={p.display_name ?? ""}
                        className="w-32 rounded border px-2 py-0.5 text-sm"
                      />
                      <button className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs hover:bg-neutral-200">
                        ✓
                      </button>
                    </form>
                  ) : (
                    p.display_name
                  )}
                </td>
                <td>
                  {p.is_admin ? (
                    <span className="rounded bg-amber-100 px-2 py-1 text-amber-800">
                      Admin
                    </span>
                  ) : isAdmin ? (
                    <form action={cycleStatus} className="inline">
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="current" value={s} />
                      <button className={"rounded px-2 py-1 " + STATUS_CLS[s]}>
                        {s}
                      </button>
                    </form>
                  ) : (
                    <span className={"rounded px-2 py-1 " + STATUS_CLS[s]}>
                      {s}
                    </span>
                  )}
                </td>
                <td>
                  {isAdmin ? (
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
                        {p.has_paid ? "✓ ano" : "- ne"}
                      </button>
                    </form>
                  ) : (
                    <span
                      className={
                        p.has_paid
                          ? "rounded bg-emerald-100 px-2 py-1 text-emerald-800"
                          : "rounded bg-neutral-100 px-2 py-1 text-neutral-600"
                      }
                    >
                      {p.has_paid ? "✓ ano" : "- ne"}
                    </span>
                  )}
                </td>
                <td
                  className="text-neutral-500"
                  title={p.last_seen_at ? formatPraguePretty(p.last_seen_at) : ""}
                >
                  {p.id === user!.id ||
                  (p.last_seen_at &&
                    Date.now() - new Date(p.last_seen_at).getTime() <= 3 * 60 * 1000) ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                      online
                    </span>
                  ) : (
                    relativeFromNow(p.last_seen_at)
                  )}
                </td>
                {isAdmin && (
                  <td className="py-2 text-right pr-2">
                    {typeof p.email === "string" &&
                      p.email.toLowerCase().endsWith(DUMMY_EMAIL_SUFFIX) &&
                      p.id !== user!.id && (
                        <form action={deleteDummy} className="inline">
                          <input type="hidden" name="id" value={p.id} />
                          <input type="hidden" name="email" value={p.email} />
                          <button
                            className="rounded bg-rose-100 px-1.5 py-0.5 text-xs text-rose-700 hover:bg-rose-200"
                          >
                            🗑️
                          </button>
                        </form>
                      )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </main>
  );
}
