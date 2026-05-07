import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NavLinks } from "@/components/nav-links";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, is_admin, is_approved, last_seen_at")
    .eq("id", user.id)
    .single();

  if (!profile?.is_approved) redirect("/pending");

  // Pro admina: spočítat čekající pozdní tipy + neschválené hráče (badge v navu)
  let pendingCount = 0;
  let unapprovedCount = 0;
  if (profile.is_admin) {
    const [pendingRes, unapprovedRes] = await Promise.all([
      supabase
        .from("pending_picks")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("is_approved", false),
    ]);
    pendingCount = pendingRes.count ?? 0;
    unapprovedCount = unapprovedRes.count ?? 0;
  }

  // Throttled update last_seen_at (max jednou za 2 minuty)
  const lastSeen = profile?.last_seen_at
    ? new Date(profile.last_seen_at).getTime()
    : 0;
  if (Date.now() - lastSeen > 2 * 60 * 1000) {
    await supabase
      .from("profiles")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", user.id);
  }

  async function logout() {
    "use server";
    const sb = await createClient();
    await sb.auth.signOut();
    redirect("/login");
  }

  return (
    <>
      <header className="sticky top-0 z-20 border-b bg-white">
        <nav className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-3 text-sm">
          <NavLinks
            isAdmin={!!profile.is_admin}
            pendingCount={pendingCount}
            unapprovedCount={unapprovedCount}
          />
          <span className="ml-auto text-neutral-500">{profile.display_name}</span>
          <form action={logout}><button className="hover:underline">Odhlásit</button></form>
        </nav>
      </header>
      <div className="mx-auto max-w-7xl px-4 py-6">{children}</div>
    </>
  );
}
