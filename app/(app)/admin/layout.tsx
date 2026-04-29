import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!profile?.is_admin) redirect("/schedule");

  return (
    <div>
      <nav className="mb-6 flex gap-4 border-b pb-2 text-sm">
        <Link href="/admin" className="font-semibold">Admin</Link>
        <Link href="/admin/users" className="hover:underline">Hráči</Link>
        <Link href="/admin/matches" className="hover:underline">Zápasy & výsledky</Link>
      </nav>
      {children}
    </div>
  );
}
