import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, is_admin, is_approved")
    .eq("id", user.id)
    .single();

  if (!profile?.is_approved) redirect("/auth/pending");

  async function logout() {
    "use server";
    const sb = await createClient();
    await sb.auth.signOut();
    redirect("/auth/login");
  }

  return (
    <>
      <header className="border-b bg-white">
        <nav className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3 text-sm">
          <Link href="/schedule" className="font-semibold">🏒 Tipovačka</Link>
          <Link href="/schedule" className="text-neutral-700 hover:underline">Zápasy</Link>
          <Link href="/leaderboard" className="text-neutral-700 hover:underline">Pořadí</Link>
          <Link href="/rules" className="text-neutral-700 hover:underline">Pravidla</Link>
          {profile.is_admin && (
            <Link href="/admin" className="text-amber-700 hover:underline">Admin</Link>
          )}
          <span className="ml-auto text-neutral-500">{profile.display_name}</span>
          <form action={logout}><button className="hover:underline">Odhlásit</button></form>
        </nav>
      </header>
      <div className="mx-auto max-w-5xl px-4 py-6">{children}</div>
    </>
  );
}
