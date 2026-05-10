import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { formatPraguePretty } from "@/lib/tz";
import { StatusMenu } from "@/components/status-menu";
import { setStatus } from "./actions";
import { DeleteAccountButton } from "@/components/delete-account-button";

const DUMMY_EMAIL_SUFFIX = "@tipovacka.local";

type Status = "Neschválen" | "Tipující" | "Admin";

function statusOf(p: { is_approved: boolean; is_admin?: boolean }): Status {
  if (p.is_admin) return "Admin";
  return p.is_approved ? "Tipující" : "Neschválen";
}

const STATUS_CLS: Record<Status, string> = {
  Neschválen: "bg-neutral-100 text-neutral-600",
  Tipující: "bg-emerald-100 text-emerald-800",
  Admin: "bg-amber-100 text-amber-800",
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

  // 3 skupiny: approved players (Hráči), unapproved players (Neschválení), admins (Adminy)
  const { data: allProfiles } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  const approvedPlayers = (allProfiles ?? []).filter(
    (p: any) => !p.is_admin && p.is_approved,
  );
  const unapprovedPlayers = (allProfiles ?? []).filter(
    (p: any) => !p.is_admin && !p.is_approved,
  );
  const admins = (allProfiles ?? []).filter((p: any) => p.is_admin);

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
    const name = String(formData.get("display_name") ?? "").trim().slice(0, 12);
    if (!name) return;
    await sb.from("profiles").update({ display_name: name }).eq("id", id);
    revalidatePath("/hraci");
    revalidatePath("/schedule");
  }

  async function deleteAccount(formData: FormData) {
    "use server";
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
    if (id === caller.id) return;

    // Server-side guard: smazat lze jen neschváleného non-admin hráče
    const { data: target } = await sb
      .from("profiles")
      .select("is_admin, is_approved")
      .eq("id", id)
      .single();
    if (!target || target.is_admin || target.is_approved) return;

    const admin = createServiceClient();
    await admin.auth.admin.deleteUser(id);

    revalidatePath("/hraci");
    revalidatePath("/schedule");
  }

  function renderRow(p: any, opts: { showDelete: boolean; showZaplatil: boolean }) {
    const s = statusOf(p);
    const isDummyEmail =
      typeof p.email === "string" &&
      p.email.toLowerCase().endsWith(DUMMY_EMAIL_SUFFIX);
    return (
      <tr key={p.id} className="border-b">
        {isAdmin && (
          <td
            className="w-[240px] max-w-[240px] truncate py-2 text-xs text-neutral-600 md:w-[210px] md:max-w-[210px]"
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
                maxLength={12}
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
          {isAdmin && p.id !== user!.id ? (
            <StatusMenu id={p.id} current={s} action={setStatus} />
          ) : (
            <span className={"rounded px-2 py-1 " + STATUS_CLS[s]}>
              {s}
            </span>
          )}
        </td>
        {opts.showZaplatil && (
          <td>
            {isAdmin ? (
              <form action={togglePaid} className="inline">
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="value" value={(!p.has_paid).toString()} />
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
        )}
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
        {opts.showDelete && (
          <td className="py-2 pr-2 text-right">
            {p.id !== user!.id && (
              <DeleteAccountButton
                id={p.id}
                email={p.email ?? ""}
                displayName={p.display_name}
                isDummy={isDummyEmail}
                action={deleteAccount}
              />
            )}
          </td>
        )}
      </tr>
    );
  }

  function EmailTh() {
    return (
      <th
        className="w-[240px] py-2 pr-4 text-xs font-medium md:w-[210px]"
      >
        Email
      </th>
    );
  }

  return (
    <main>
      <h1 className="mb-4 text-xl font-semibold">Hráči</h1>

      <table className="text-sm">
        <thead className="border-b text-left text-neutral-500">
          <tr>
            {isAdmin && <EmailTh />}
            <th className="py-2 pr-4" style={{ width: "200px" }}>Přezdívka</th>
            <th className="pr-4" style={{ width: "130px" }}>Status</th>
            <th className="pr-4" style={{ width: "90px" }}>Zaplatil</th>
            <th className="pr-4" style={{ width: "175px" }}>Naposledy viděn</th>
          </tr>
        </thead>
        <tbody>
          {approvedPlayers.map((p: any) =>
            renderRow(p, { showDelete: false, showZaplatil: true }),
          )}
        </tbody>
      </table>

      {isAdmin && unapprovedPlayers.length > 0 && (
        <>
          <h2 className="mb-3 mt-10 text-lg font-semibold text-neutral-700">
            Neschválení
          </h2>
          <table className="text-sm">
            <thead className="border-b text-left text-neutral-500">
              <tr>
                <EmailTh />
                <th className="py-2 pr-4" style={{ width: "200px" }}>Přezdívka</th>
                <th className="pr-4" style={{ width: "130px" }}>Status</th>
                <th className="pr-4" style={{ width: "90px" }}>Zaplatil</th>
                <th className="pr-4" style={{ width: "175px" }}>Naposledy viděn</th>
                <th className="py-2 pr-2 text-right">Smazat</th>
              </tr>
            </thead>
            <tbody>
              {unapprovedPlayers.map((p: any) =>
                renderRow(p, { showDelete: true, showZaplatil: true }),
              )}
            </tbody>
          </table>
        </>
      )}

      {isAdmin && admins.length > 0 && (
        <>
          <h2 className="mb-3 mt-10 text-lg font-semibold text-amber-800">Adminy</h2>
          <table className="text-sm">
            <thead className="border-b text-left text-neutral-500">
              <tr>
                <EmailTh />
                <th className="py-2 pr-4" style={{ width: "200px" }}>Přezdívka</th>
                <th className="pr-4" style={{ width: "130px" }}>Status</th>
                <th className="pr-4" style={{ width: "175px" }}>Naposledy viděn</th>
              </tr>
            </thead>
            <tbody>
              {admins.map((p: any) =>
                renderRow(p, { showDelete: false, showZaplatil: false }),
              )}
            </tbody>
          </table>
        </>
      )}
    </main>
  );
}
