import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { formatPraguePretty } from "@/lib/tz";
import { type Match, type Team } from "@/lib/types";
import { StatusMenu } from "@/components/status-menu";
import { setStatus } from "./actions";
import { DeleteAccountButton } from "@/components/delete-account-button";
import { SortableTh } from "@/components/sortable-th";

const DUMMY_EMAIL_SUFFIX = "@tipovacka.local";

type Status = "Nevyřízený" | "Neschválen" | "Tipující" | "Admin";

function statusOf(p: { is_approved: boolean; is_admin?: boolean; is_rejected?: boolean }): Status {
  if (p.is_admin) return "Admin";
  if (p.is_approved) return "Tipující";
  return p.is_rejected ? "Neschválen" : "Nevyřízený";
}

const STATUS_CLS: Record<Status, string> = {
  Nevyřízený: "bg-neutral-300 text-neutral-700",
  Neschválen: "bg-neutral-100 text-neutral-600",
  Tipující: "bg-emerald-100 text-emerald-800",
  Admin: "bg-amber-100 text-amber-800",
};

interface AuditRow {
  id: number;
  user_id: string;
  match_id: number;
  home_score: number | null;
  away_score: number | null;
  home_score_p1: number | null;
  away_score_p1: number | null;
  action: "INSERT" | "UPDATE" | "DELETE";
  changed_by: string | null;
  changed_at: string;
}

const ACTION_CLS: Record<AuditRow["action"], string> = {
  INSERT: "bg-emerald-100 text-emerald-800",
  UPDATE: "bg-sky-100 text-sky-800",
  DELETE: "bg-rose-100 text-rose-800",
};

const ACTION_LABEL: Record<AuditRow["action"], string> = {
  INSERT: "vytvořeno",
  UPDATE: "upraveno",
  DELETE: "smazáno",
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

export default async function HraciPage({
  searchParams,
}: {
  searchParams: Promise<{ sortBy?: string; order?: string }>;
}) {
  const sp = await searchParams;
  const sortBy = sp.sortBy ?? null;
  const sortOrder = sp.order === "desc" ? "desc" : "asc";
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
  let userMetrics: Record<string, { hcp_distance: number | null; margin_err: number | null; goals_err: number | null; fav_pct: number | null; exact_count: number | null; off_one: number | null; pct_exact: number | null; pct_p1: number | null; pct_grp: number | null; pct_po: number | null; pct_cze: number | null }> = {};
  if (isAdmin) {
    const { data: metricsData } = await supabase.from("user_tip_metrics").select("*");
    for (const m of metricsData ?? []) {
      const ptsExact = Number(m.pts_exact ?? 0);
      const ptsP1 = Number(m.pts_p1 ?? 0);
      const ptsGrp = Number(m.pts_hcp_group ?? 0);
      const ptsPo = Number(m.pts_hcp_playoff ?? 0);
      const ptsCze = Number(m.pts_hcp_czech ?? 0);
      const totalPts = ptsExact + ptsP1 + ptsGrp + ptsPo + ptsCze;
      userMetrics[m.user_id] = {
        hcp_distance: m.avg_hcp_distance,
        margin_err: m.avg_margin_error,
        goals_err: m.avg_goals_error,
        fav_pct: m.fav_pct,
        exact_count: m.exact_count,
        off_one: m.off_by_one_count,
        pct_exact: totalPts > 0 ? (ptsExact / totalPts) * 100 : null,
        pct_p1: totalPts > 0 ? (ptsP1 / totalPts) * 100 : null,
        pct_grp: totalPts > 0 ? (ptsGrp / totalPts) * 100 : null,
        pct_po: totalPts > 0 ? (ptsPo / totalPts) * 100 : null,
        pct_cze: totalPts > 0 ? (ptsCze / totalPts) * 100 : null,
      };
    }
  }
  let pendingCount = 0;
  if (isAdmin) {
    const { count } = await supabase
      .from("pending_picks")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");
    pendingCount = count ?? 0;
  }

  const { data: allProfiles } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  // Aktivita: picks_audit má RLS jen pro admina, takže pro non-admin viewers
  // čteme přes service client. Limit 100 řádků.
  const adminSb = createServiceClient();
  const [{ data: auditData }, { data: matchesData }, { data: teamsData }] = await Promise.all([
    adminSb
      .from("picks_audit")
      .select("*")
      .order("changed_at", { ascending: false })
      .limit(50),
    supabase.from("matches").select("*"),
    supabase.from("teams").select("*"),
  ]);

  let approvedPlayers = (allProfiles ?? []).filter(
    (p: any) => !p.is_admin && p.is_approved,
  );
  if (isAdmin && sortBy && ["spread", "naskok", "goly", "fav", "exact", "off1", "ex_pct", "p1_pct", "grp_pct", "po_pct", "cze_pct"].includes(sortBy)) {
    const fieldKey =
      sortBy === "spread" ? "hcp_distance"
        : sortBy === "naskok" ? "margin_err"
        : sortBy === "goly" ? "goals_err"
        : sortBy === "fav" ? "fav_pct"
        : sortBy === "exact" ? "exact_count"
        : sortBy === "off1" ? "off_one"
        : sortBy === "ex_pct" ? "pct_exact"
        : sortBy === "p1_pct" ? "pct_p1"
        : sortBy === "grp_pct" ? "pct_grp"
        : sortBy === "po_pct" ? "pct_po"
        : "pct_cze";
    approvedPlayers = approvedPlayers.slice().sort((a: any, b: any) => {
      const va = userMetrics[a.id]?.[fieldKey] ?? null;
      const vb = userMetrics[b.id]?.[fieldKey] ?? null;
      if (va === null && vb === null) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;
      return sortOrder === "asc" ? va - vb : vb - va;
    });
  }
  const unapprovedPlayers = (allProfiles ?? []).filter(
    (p: any) => !p.is_admin && !p.is_approved,
  );
  // Split unapproved into pending (no admin decision yet) and rejected.
  // Status "Nevyřízený" = pending decision; status "Neschválen" = rejected (moves to Neschválené účty).
  const pendingPlayers = unapprovedPlayers.filter((p: any) => !p.is_rejected);
  const rejectedPlayers = unapprovedPlayers.filter((p: any) => !!p.is_rejected);
  const admins = (allProfiles ?? []).filter((p: any) => p.is_admin);

  const profileMap = new Map(
    (allProfiles ?? []).map((p: { id: string; display_name: string }) => [
      p.id,
      p.display_name,
    ]),
  );
  const matchMap = new Map(
    (matchesData ?? []).map((m: any) => [m.id, m as Match]),
  );
  const teamMap = new Map(
    (teamsData ?? []).map((t: any) => [t.code, t as Team]),
  );
  const allAudit = (auditData ?? []) as AuditRow[];
  // Pro non-admin viewers schovej řádky kde "Změnil" by se zobrazil jako "-":
  // - changed_by je null (cascadové DELETE bez auth.uid())
  // - changed_by je UUID smazaného uživatele (nemáme jeho profile)
  const auditRows = isAdmin
    ? allAudit
    : allAudit.filter(
        (r) => r.changed_by !== null && profileMap.has(r.changed_by),
      );

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
        {isAdmin && (() => {
          const um = userMetrics[p.id];
          const fmt = (v: number | null | undefined) => v == null ? "–" : v.toFixed(2);
          return (
            <>
              <td className="w-[64px] py-2 pr-3 text-right text-xs tabular-nums text-neutral-700">{fmt(um?.hcp_distance)}</td>
              <td className="w-[64px] py-2 pr-3 text-right text-xs tabular-nums text-neutral-700">{fmt(um?.margin_err)}</td>
              <td className="w-[64px] py-2 pr-3 text-right text-xs tabular-nums text-neutral-700">{fmt(um?.goals_err)}</td>
              <td className="w-[64px] py-2 pr-3 text-right text-xs tabular-nums text-neutral-700">{um?.fav_pct == null ? "—" : Math.round(um.fav_pct) + "%"}</td>
              <td className="w-[64px] py-2 pr-3 text-right text-xs tabular-nums text-neutral-700">{um?.exact_count ?? 0}</td>
              <td className="w-[64px] py-2 pr-3 text-right text-xs tabular-nums text-neutral-700">{um?.off_one ?? 0}</td>
              <td className="w-[64px] py-2 pr-3 text-right text-xs tabular-nums text-neutral-700">{um?.pct_exact == null ? "—" : Math.round(um.pct_exact) + "%"}</td>
              <td className="w-[64px] py-2 pr-3 text-right text-xs tabular-nums text-neutral-700">{um?.pct_p1 == null ? "—" : Math.round(um.pct_p1) + "%"}</td>
              <td className="w-[64px] py-2 pr-3 text-right text-xs tabular-nums text-neutral-700">{um?.pct_grp == null ? "—" : Math.round(um.pct_grp) + "%"}</td>
              <td className="w-[64px] py-2 pr-3 text-right text-xs tabular-nums text-neutral-700">{um?.pct_po == null ? "—" : Math.round(um.pct_po) + "%"}</td>
              <td className="w-[64px] py-2 pr-3 text-right text-xs tabular-nums text-neutral-700">{um?.pct_cze == null ? "—" : Math.round(um.pct_cze) + "%"}</td>
            </>
          );
        })()}
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
        {isAdmin && (
          <td>
            {p.id !== user!.id ? (
              <StatusMenu id={p.id} current={s} action={setStatus} />
            ) : (
              <span className={"rounded px-2 py-1 " + STATUS_CLS[s]}>
                {s}
              </span>
            )}
          </td>
        )}
        {isAdmin && opts.showZaplatil && (
          <td>
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
      <th className="w-[240px] py-2 pr-4 text-xs font-medium md:w-[210px]">
        Email
      </th>
    );
  }

  return (
    <main>
      {isAdmin && (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <a
            href="/admin/pending"
            className={
              "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs " +
              (pendingCount > 0
                ? "border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100"
                : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50")
            }
          >
            Pozdní tipy
            <span
              className={
                "inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-semibold " +
                (pendingCount > 0 ? "bg-rose-600 text-white" : "bg-neutral-200 text-neutral-700")
              }
            >
              {pendingCount}
            </span>
          </a>
          <a
            href="/admin/podobnost"
            className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-50"
          >
            Podobnost tipérů
          </a>
        </div>
      )}
      <h1 className="mb-4 text-xl font-semibold">Hráči a aktivita</h1>

      <table className="text-sm">
        <thead className="border-b text-left text-neutral-500">
          <tr>
            {isAdmin && (
              <>
                <SortableTh field="spread" label="spread" title="Průměrná |pickDiff + hcp| napříč všemi tipy" width="w-[64px]" />
                <SortableTh field="naskok" label="náskok" title="Průměrná |pickDiff - actualDiff| nad finalizovanými zápasy" width="w-[64px]" />
                <SortableTh field="goly" label="góly" title="Průměrná |pickHome - actualHome| + |pickAway - actualAway| nad finalizovanými zápasy" width="w-[64px]" />
                <SortableTh field="fav" label="%Fav" title="% tipů, kde tipér zvolil favorita (záporný handicap)" width="w-[64px]" />
                <SortableTh field="exact" label="Výsledky" title="Počet přesných výsledků" width="w-[64px]" />
                <SortableTh field="off1" label="O jeden" title="Počet tipů netrefených o jeden gól" width="w-[64px]" />
                <SortableTh field="ex_pct" label="%Výs" title="Podíl bodů z přesných výsledků" width="w-[64px]" />
                <SortableTh field="p1_pct" label="%P1" title="Podíl bodů z 1. třetin" width="w-[64px]" />
                <SortableTh field="grp_pct" label="%Grp" title="Podíl bodů z handicapů skupiny" width="w-[64px]" />
                <SortableTh field="po_pct" label="%Po" title="Podíl bodů z handicapů playoff" width="w-[64px]" />
                <SortableTh field="cze_pct" label="%ČZ" title="Podíl bodů z handicapů českého týmu" width="w-[64px]" />
                <EmailTh />
              </>
            )}
            <th className="py-2 pr-4" style={{ width: "200px" }}>Přezdívka</th>
            {isAdmin && <th className="pr-4" style={{ width: "130px" }}>Status</th>}
            {isAdmin && <th className="pr-4" style={{ width: "90px" }}>Zaplatil</th>}
            <th className="pr-4" style={{ width: "175px" }}>Naposledy viděn</th>
            {isAdmin && <th className="py-2 pr-2 text-right">Smazat</th>}
          </tr>
        </thead>
        <tbody>
          {approvedPlayers.map((p: any) =>
            renderRow(p, { showDelete: isAdmin, showZaplatil: true }),
          )}
          {isAdmin && approvedPlayers.length > 0 && (() => {
            const keys = ["hcp_distance","margin_err","goals_err","fav_pct","exact_count","off_one","pct_exact","pct_p1","pct_grp","pct_po","pct_cze"] as const;
            const sums: Record<string, number> = {};
            const counts: Record<string, number> = {};
            for (const p of approvedPlayers as any[]) {
              const um = userMetrics[p.id];
              if (!um) continue;
              for (const k of keys) {
                const v = (um as any)[k];
                if (v == null) continue;
                sums[k] = (sums[k] ?? 0) + Number(v);
                counts[k] = (counts[k] ?? 0) + 1;
              }
            }
            const avg: Record<string, number | null> = {};
            for (const k of keys) avg[k] = counts[k] ? sums[k] / counts[k] : null;
            const fmt = (v: number | null) => v == null ? "—" : v.toFixed(2);
            const fmtPct = (v: number | null) => v == null ? "—" : Math.round(v) + "%";
            const fmtCount = (v: number | null) => v == null ? "—" : v.toFixed(1);
            const tc = "w-[64px] py-2 pr-3 text-right text-xs tabular-nums text-neutral-700 font-medium";
            return (
              <tr className="border-t-2 border-neutral-400 bg-neutral-100 font-medium">
                <td className={tc}>{fmt(avg.hcp_distance)}</td>
                <td className={tc}>{fmt(avg.margin_err)}</td>
                <td className={tc}>{fmt(avg.goals_err)}</td>
                <td className={tc}>{fmtPct(avg.fav_pct)}</td>
                <td className={tc}>{fmtCount(avg.exact_count)}</td>
                <td className={tc}>{fmtCount(avg.off_one)}</td>
                <td className={tc}>{fmtPct(avg.pct_exact)}</td>
                <td className={tc}>{fmtPct(avg.pct_p1)}</td>
                <td className={tc}>{fmtPct(avg.pct_grp)}</td>
                <td className={tc}>{fmtPct(avg.pct_po)}</td>
                <td className={tc}>{fmtPct(avg.pct_cze)}</td>
                <td className="py-2 text-xs italic text-neutral-600" colSpan={6}>Průměr týmu ({approvedPlayers.length} hráčů)</td>
              </tr>
            );
          })()}
        </tbody>
      </table>

      {isAdmin && pendingPlayers.length > 0 && (
        <>
          <h2 className="mb-3 mt-10 text-lg font-semibold text-neutral-700">
            Neschválení
          </h2>
          <table className="text-sm">
            <thead className="border-b text-left text-neutral-500">
              <tr>
                <th className="py-2 pr-3 text-right text-xs font-medium w-[64px]" title="Průměrná |pickDiff + hcp| napříč všemi tipy">spread</th>
                <th className="py-2 pr-3 text-right text-xs font-medium w-[64px]" title="Průměrná |pickDiff - actualDiff| nad finalizovanými zápasy">náskok</th>
                <th className="py-2 pr-3 text-right text-xs font-medium w-[64px]" title="Průměrná |pickHome - actualHome| + |pickAway - actualAway| nad finalizovanými zápasy">góly</th>
                <th className="py-2 pr-3 text-right text-xs font-medium w-[64px]" title="% tipů, kde tipér zvolil favorita (záporný handicap)">%Fav</th>
                <th className="py-2 pr-3 text-right text-xs font-medium w-[64px]" title="Počet přesných výsledků">Výsledky</th>
                <th className="py-2 pr-3 text-right text-xs font-medium w-[64px]" title="Počet tipů netrefených o jeden gól">O jeden</th>
                <th className="py-2 pr-3 text-right text-xs font-medium w-[64px]" title="Podíl bodů z přesných výsledků">%Výs</th>
                <th className="py-2 pr-3 text-right text-xs font-medium w-[64px]" title="Podíl bodů z 1. třetin">%P1</th>
                <th className="py-2 pr-3 text-right text-xs font-medium w-[64px]" title="Podíl bodů z handicapů skupiny">%Grp</th>
                <th className="py-2 pr-3 text-right text-xs font-medium w-[64px]" title="Podíl bodů z handicapů playoff">%Po</th>
                <th className="py-2 pr-3 text-right text-xs font-medium w-[64px]" title="Podíl bodů z handicapů českého týmu">%ČZ</th>
                <EmailTh />
                <th className="py-2 pr-4" style={{ width: "200px" }}>Přezdívka</th>
                <th className="pr-4" style={{ width: "130px" }}>Status</th>
                <th className="pr-4" style={{ width: "90px" }}>Zaplatil</th>
                <th className="pr-4" style={{ width: "175px" }}>Naposledy viděn</th>
                <th className="py-2 pr-2 text-right">Smazat</th>
              </tr>
            </thead>
            <tbody>
              {pendingPlayers.map((p: any) =>
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
                <th className="py-2 pr-3 text-right text-xs font-medium w-[64px]" title="Průměrná |pickDiff + hcp| napříč všemi tipy">spread</th>
                <th className="py-2 pr-3 text-right text-xs font-medium w-[64px]" title="Průměrná |pickDiff - actualDiff| nad finalizovanými zápasy">náskok</th>
                <th className="py-2 pr-3 text-right text-xs font-medium w-[64px]" title="Průměrná |pickHome - actualHome| + |pickAway - actualAway| nad finalizovanými zápasy">góly</th>
                <th className="py-2 pr-3 text-right text-xs font-medium w-[64px]" title="% tipů, kde tipér zvolil favorita (záporný handicap)">%Fav</th>
                <th className="py-2 pr-3 text-right text-xs font-medium w-[64px]" title="Počet přesných výsledků">Výsledky</th>
                <th className="py-2 pr-3 text-right text-xs font-medium w-[64px]" title="Počet tipů netrefených o jeden gól">O jeden</th>
                <th className="py-2 pr-3 text-right text-xs font-medium w-[64px]" title="Podíl bodů z přesných výsledků">%Výs</th>
                <th className="py-2 pr-3 text-right text-xs font-medium w-[64px]" title="Podíl bodů z 1. třetin">%P1</th>
                <th className="py-2 pr-3 text-right text-xs font-medium w-[64px]" title="Podíl bodů z handicapů skupiny">%Grp</th>
                <th className="py-2 pr-3 text-right text-xs font-medium w-[64px]" title="Podíl bodů z handicapů playoff">%Po</th>
                <th className="py-2 pr-3 text-right text-xs font-medium w-[64px]" title="Podíl bodů z handicapů českého týmu">%ČZ</th>
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

      {isAdmin && rejectedPlayers.length > 0 && (
        <>
          <h2 className="mb-3 mt-10 text-lg font-semibold text-neutral-700">
            Neschválené účty
          </h2>
          <table className="text-sm">
            <thead className="border-b text-left text-neutral-500">
              <tr>
                <th className="py-2 pr-3 text-right text-xs font-medium w-[64px]" title="Průměrná |pickDiff + hcp| napříč všemi tipy">spread</th>
                <th className="py-2 pr-3 text-right text-xs font-medium w-[64px]" title="Průměrná |pickDiff - actualDiff| nad finalizovanými zápasy">náskok</th>
                <th className="py-2 pr-3 text-right text-xs font-medium w-[64px]" title="Průměrná |pickHome - actualHome| + |pickAway - actualAway| nad finalizovanými zápasy">góly</th>
                <th className="py-2 pr-3 text-right text-xs font-medium w-[64px]" title="% tipů, kde tipér zvolil favorita (záporný handicap)">%Fav</th>
                <th className="py-2 pr-3 text-right text-xs font-medium w-[64px]" title="Počet přesných výsledků">Výsledky</th>
                <th className="py-2 pr-3 text-right text-xs font-medium w-[64px]" title="Počet tipů netrefených o jeden gól">O jeden</th>
                <th className="py-2 pr-3 text-right text-xs font-medium w-[64px]" title="Podíl bodů z přesných výsledků">%Výs</th>
                <th className="py-2 pr-3 text-right text-xs font-medium w-[64px]" title="Podíl bodů z 1. třetin">%P1</th>
                <th className="py-2 pr-3 text-right text-xs font-medium w-[64px]" title="Podíl bodů z handicapů skupiny">%Grp</th>
                <th className="py-2 pr-3 text-right text-xs font-medium w-[64px]" title="Podíl bodů z handicapů playoff">%Po</th>
                <th className="py-2 pr-3 text-right text-xs font-medium w-[64px]" title="Podíl bodů z handicapů českého týmu">%ČZ</th>
                <EmailTh />
                <th className="py-2 pr-4" style={{ width: "200px" }}>Přezdívka</th>
                <th className="pr-4" style={{ width: "130px" }}>Status</th>
                <th className="pr-4" style={{ width: "90px" }}>Zaplatil</th>
                <th className="pr-4" style={{ width: "175px" }}>Naposledy viděn</th>
                <th className="py-2 pr-2 text-right">Smazat</th>
              </tr>
            </thead>
            <tbody>
              {rejectedPlayers.map((p: any) =>
                renderRow(p, { showDelete: true, showZaplatil: true }),
              )}
            </tbody>
          </table>
        </>
      )}

      <h2 className="mb-3 mt-10 text-lg font-semibold text-neutral-700">Aktivita</h2>
      <p className="mb-3 text-xs text-neutral-500">
        Posledních 50 změn tipů (vytvoření, úpravy, smazání).
      </p>
      <div className="overflow-x-auto mb-10">
        <table className="text-sm">
          <thead className="border-b text-left text-neutral-500">
            <tr>
              <th className="py-2 pr-3">Kdy</th>
              <th className="pr-3">Hráč</th>
              <th className="pr-3">Akce</th>
              <th className="pr-3">Zápas</th>
              <th className="pr-3">60'</th>
              <th className="pr-3">1 tř.</th>
              <th className="pr-3">Změnil</th>
            </tr>
          </thead>
          <tbody>
            {auditRows.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-6 text-center text-neutral-500">
                  Zatím nic.
                </td>
              </tr>
            ) : (
              auditRows.map((r) => {
                const m = matchMap.get(r.match_id);
                const home = m ? teamMap.get(m.home_code) : null;
                const away = m ? teamMap.get(m.away_code) : null;
                const matchLabel = m
                  ? `${home?.name_cs ?? m.home_code} vs ${away?.name_cs ?? m.away_code}`
                  : `#${r.match_id}`;
                  const tip60 =
                  r.home_score == null || r.away_score == null
                    ? "-"
                    : `${r.home_score}:${r.away_score}`;
                const tipP1 =
                  r.home_score_p1 == null || r.away_score_p1 == null
                    ? "-"
                    : `${r.home_score_p1}:${r.away_score_p1}`;
                const changedByName = r.changed_by
                  ? profileMap.get(r.changed_by) ?? "-"
                  : "-";
                const isAdminOverride =
                  r.changed_by !== null && r.changed_by !== r.user_id;
                const matchStarted = m
                  ? new Date(m.starts_at).getTime() <= Date.now()
                  : false;
                const canSeeTip = isAdmin || r.user_id === user!.id || matchStarted;
                const tip60Display = canSeeTip ? tip60 : "🔒";
                const tipP1Display = canSeeTip ? tipP1 : "🔒";
                return (
                  <tr key={r.id} className="border-b">
                    <td className="whitespace-nowrap py-2 pr-3 text-neutral-600">
                      {formatPraguePretty(r.changed_at)}
                    </td>
                    <td className="pr-3 font-medium">
                      {profileMap.get(r.user_id) ?? r.user_id.slice(0, 8)}
                    </td>
                    <td className="pr-3">
                      <span
                        className={
                          "rounded px-2 py-0.5 text-xs " + ACTION_CLS[r.action]
                        }
                      >
                        {ACTION_LABEL[r.action]}
                      </span>
                    </td>
                    <td className="whitespace-nowrap pr-3">
                      {m && (
                        <span className="mr-2 text-neutral-500">
                          {formatPraguePretty(m.starts_at)}
                        </span>
                      )}
                      {matchLabel}
                      {m?.is_czech && (
                        <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-[11px] text-red-700">
                          🇨🇿
                        </span>
                      )}
                    </td>
                    <td className="pr-3 tabular-nums">{tip60Display}</td>
                    <td className="pr-3 tabular-nums text-neutral-500">{tipP1Display}</td>
                    <td className="pr-3 text-neutral-600">
                      {changedByName}
                      {isAdminOverride && (
                        <span className="ml-1 rounded bg-amber-100 px-1 py-0.5 text-[10px] text-amber-800">
                          admin
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {!isAdmin && (() => {
        const publicAdmins = admins.filter(
          (a: any) =>
            typeof a.email === "string" &&
            a.email.length > 0 &&
            !a.email.toLowerCase().endsWith(DUMMY_EMAIL_SUFFIX),
        );
        if (publicAdmins.length === 0) return null;
        return (
          <>
            <h2 className="mb-2 mt-10 text-lg font-semibold text-amber-800">
              Adminy
            </h2>
            <p className="mb-3 text-xs text-neutral-500">
              Účty adminů s ověřeným emailem (kontrola, že admin si nepomáhá nakukováním na tipy ostatních).
            </p>
            <table className="text-sm">
              <thead className="border-b text-left text-neutral-500">
                <tr>
                  <th className="py-2 pr-4" style={{ width: "200px" }}>Přezdívka</th>
                  <th className="pr-4" style={{ width: "175px" }}>Naposledy viděn</th>
                </tr>
              </thead>
              <tbody>
                {publicAdmins.map((p: any) =>
                  renderRow(p, { showDelete: false, showZaplatil: false }),
                )}
              </tbody>
            </table>
          </>
        );
      })()}
    </main>
  );
}
