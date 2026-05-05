import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function AdminHome() {
  const supabase = await createClient();
  const [pending, upcoming, finalized] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("is_approved", false),
    supabase.from("matches").select("*", { count: "exact", head: true }).eq("finalized", false),
    supabase.from("matches").select("*", { count: "exact", head: true }).eq("finalized", true),
  ]);

  return (
    <main className="grid gap-4 sm:grid-cols-3">
      <Link href="/admin/users" className="rounded-lg border bg-white p-4">
        <div className="text-3xl font-bold">{pending.count ?? 0}</div>
        <div className="text-sm text-neutral-600">žádostí o schválení</div>
      </Link>
      <Link href="/admin/matches" className="rounded-lg border bg-white p-4">
        <div className="text-3xl font-bold">{upcoming.count ?? 0}</div>
        <div className="text-sm text-neutral-600">nedokončených zápasů</div>
      </Link>
      <Link href="/admin/matches" className="rounded-lg border bg-white p-4">
        <div className="text-3xl font-bold">{finalized.count ?? 0}</div>
        <div className="text-sm text-neutral-600">finalizovaných zápasů</div>
      </Link>
    </main>
  );
}
