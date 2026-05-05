import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { formatPraguePretty } from "@/lib/tz";
import { STAGE_LABEL, type Match, type Team } from "@/lib/types";

interface PendingRow {
  id: number;
  user_id: string;
  match_id: number;
  home_score: number;
  away_score: number;
  home_score_p1: number | null;
  away_score_p1: number | null;
  status: "pending" | "approved" | "rejected";
  requested_at: string;
}

export default async function AdminPendingPage() {
  const supabase = await createClient();
  const [pendingRes, profilesRes, matchesRes, teamsRes] = await Promise.all([
    supabase
      .from("pending_picks")
      .select("*")
      .eq("status", "pending")
      .order("requested_at", { ascending: false }),
    supabase.from("profiles").select("id, display_name"),
    supabase.from("matches").select("*"),
    supabase.from("teams").select("*"),
  ]);

  const profileMap = new Map(
    (profilesRes.data ?? []).map((p: { id: string; display_name: string }) => [
      p.id,
      p.display_name,
    ]),
  );
  const matchMap = new Map((matchesRes.data ?? []).map((m) => [m.id, m as Match]));
  const teamMap = new Map((teamsRes.data ?? []).map((t) => [t.code, t as Team]));

  const rows = (pendingRes.data ?? []) as PendingRow[];

  async function approve(formData: FormData) {
    "use server";
    const sb = await createClient();
    const id = Number(formData.get("id"));
    await sb.rpc("approve_pending_pick", { p_id: id });
    revalidatePath("/admin/pending");
    revalidatePath("/schedule");
    revalidatePath("/admin/history");
  }

  async function reject(formData: FormData) {
    "use server";
    const sb = await createClient();
    const id = Number(formData.get("id"));
    await sb.rpc("reject_pending_pick", { p_id: id });
    revalidatePath("/admin/pending");
  }

  return (
    <main>
      <h1 className="mb-1 text-xl font-semibold">Pozdě zadané tipy</h1>
      <p className="mb-4 text-sm text-neutral-600">
        Tipy zaslané do 10 min po začátku zápasu. Schvaluješ jako Master.
      </p>

      <table className="w-full text-sm">
        <thead className="border-b text-left text-neutral-500">
          <tr>
            <th className="py-2 pr-3">Zaslán</th>
            <th className="pr-3">Hráč</th>
            <th className="pr-3">Zápas</th>
            <th className="pr-3">Tip 60′</th>
            <th className="pr-3">Tip 1. tř.</th>
            <th className="pr-3">Akce</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={6} className="py-6 text-center text-neutral-500">
                Žádné čekající tipy.
              </td>
            </tr>
          ) : (
            rows.map((r) => {
              const m = matchMap.get(r.match_id);
              const home = m ? teamMap.get(m.home_code) : null;
              const away = m ? teamMap.get(m.away_code) : null;
              const matchLabel = m
                ? `${home?.name_cs ?? m.home_code} vs ${away?.name_cs ?? m.away_code}`
                : `#${r.match_id}`;
              const stageLabel = m ? STAGE_LABEL[m.stage] : "";
              const startTime = m ? formatPraguePretty(m.starts_at) : "";
              const tip60 = `${r.home_score}:${r.away_score}`;
              const tipP1 =
                r.home_score_p1 == null
                  ? "-"
                  : `${r.home_score_p1}:${r.away_score_p1}`;
              return (
                <tr key={r.id} className="border-b">
                  <td className="py-2 pr-3 text-neutral-600 whitespace-nowrap">
                    {formatPraguePretty(r.requested_at)}
                  </td>
                  <td className="pr-3 font-medium">
                    {profileMap.get(r.user_id) ?? r.user_id.slice(0, 8)}
                  </td>
                  <td className="pr-3 whitespace-nowrap">
                    <span className="mr-2 text-neutral-500">{startTime}</span>
                    {stageLabel && (
                      <span className="mr-2 rounded bg-neutral-100 px-1.5 py-0.5 text-[11px] text-neutral-600">
                        {stageLabel}
                      </span>
                    )}
                    {matchLabel}
                    {m?.is_czech && (
                      <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-[11px] text-red-700">
                        🇨🇿
                      </span>
                    )}
                  </td>
                  <td className="pr-3 tabular-nums">{tip60}</td>
                  <td className="pr-3 tabular-nums text-neutral-500">{tipP1}</td>
                  <td className="pr-3">
                    <form className="inline-flex gap-1">
                      <input type="hidden" name="id" value={r.id} />
                      <button
                        formAction={approve}
                        className="rounded bg-emerald-600 px-2 py-1 text-xs text-white hover:bg-emerald-700"
                      >
                        Schválit
                      </button>
                      <button
                        formAction={reject}
                        className="rounded border border-rose-300 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50"
                      >
                        Zamítnout
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </main>
  );
}
