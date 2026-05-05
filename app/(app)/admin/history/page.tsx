import { createClient } from "@/lib/supabase/server";
import { formatPraguePretty } from "@/lib/tz";
import { STAGE_LABEL, type Match, type Team } from "@/lib/types";

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

export default async function AdminHistoryPage() {
  const supabase = await createClient();
  const [{ data: audit }, { data: profiles }, { data: matches }, { data: teams }] =
    await Promise.all([
      supabase
        .from("picks_audit")
        .select("*")
        .order("changed_at", { ascending: false }),
      supabase.from("profiles").select("id, display_name"),
      supabase.from("matches").select("*"),
      supabase.from("teams").select("*"),
    ]);

  const profileMap = new Map(
    (profiles ?? []).map((p: { id: string; display_name: string }) => [
      p.id,
      p.display_name,
    ]),
  );
  const matchMap = new Map((matches ?? []).map((m) => [m.id, m as Match]));
  const teamMap = new Map((teams ?? []).map((t) => [t.code, t as Team]));

  const rows = (audit ?? []) as AuditRow[];

  return (
    <main>
      <h1 className="mb-4 text-xl font-semibold">Historie tipů</h1>

      <table className="w-full text-sm">
        <thead className="border-b text-left text-neutral-500">
          <tr>
            <th className="py-2 pr-3">Kdy</th>
            <th className="pr-3">Hráč</th>
            <th className="pr-3">Akce</th>
            <th className="pr-3">Zápas</th>
            <th className="pr-3">Tip 60′</th>
            <th className="pr-3">Tip 1. tř.</th>
            <th className="pr-3">Změnil</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={7}
                className="py-6 text-center text-neutral-500"
              >
                Žádné záznamy.
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
              const tip60 =
                r.home_score == null && r.away_score == null
                  ? "-"
                  : `${r.home_score}:${r.away_score}`;
              const tipP1 =
                r.home_score_p1 == null && r.away_score_p1 == null
                  ? "-"
                  : `${r.home_score_p1}:${r.away_score_p1}`;
              const changedByName = r.changed_by
                ? profileMap.get(r.changed_by) ?? "-"
                : "-";
              const isAdminOverride =
                r.changed_by != null && r.changed_by !== r.user_id;
              return (
                <tr key={r.id} className="border-b">
                  <td className="py-2 pr-3 text-neutral-600 whitespace-nowrap">
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
                  <td className="pr-3 whitespace-nowrap">
                    {m && (
                      <span className="mr-2 text-neutral-500">
                        {formatPraguePretty(m.starts_at)}
                      </span>
                    )}
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
    </main>
  );
}
