import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NavLinks } from "@/components/nav-links";
import { GuestHeader } from "@/components/guest-header";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Host (nepřihlášený): zobraz veřejnou hlavičku s formulářem login/register a renderuj children.
  if (!user) {
    return (
      <>
        {/* Mobile-only login bar — v normálním flow, scrolluje pryč, MENU se ukotví. */}
        <div className="border-b bg-white md:hidden">
          <div className="mx-auto flex max-w-7xl items-center px-4 py-2 text-sm">
            <GuestHeader />
          </div>
        </div>
        {/* Menu — sticky na všech velikostech (z-50 nad table sticky cells z-40). */}
        <header className="sticky top-0 z-50 bg-white">
          <nav className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 py-3 text-sm">
            <NavLinks isAdmin={false} pendingCount={0} unapprovedCount={0} guest />
            <div className="ml-auto hidden md:block">
              <GuestHeader />
            </div>
          </nav>
        </header>
        <div className="mx-auto max-w-7xl px-4 py-6">{children}</div>
      </>
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, is_admin, is_approved, last_seen_at")
    .eq("id", user.id)
    .single();

  // Schválení už řeší middleware: unapproved user smí vidět veřejné stránky
  // (/schedule, /trophies). Pro chráněné stránky (/hraci, /admin/*, /rules)
  // je middleware přesměruje na /pending.

  // Pro admina: spočítat čekající pozdní tipy + neschválené hráče (badge v navu)
  let pendingCount = 0;
  let unapprovedCount = 0;
  if (profile?.is_admin) {
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
    redirect("/");
  }

  return (
    <>
      {/* Mobile-only userinfo bar — v normálním flow, scrolluje pryč, MENU se ukotví. */}
      <div className="border-b bg-white md:hidden">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2 text-sm">
          <Link href="/profile" className="text-neutral-500 hover:underline">{profile?.display_name}</Link>
          <form action={logout}>
            <button className="hover:underline">Odhlásit</button>
          </form>
        </div>
      </div>
      {/* Menu — sticky na všech velikostech (z-50 nad table sticky cells z-40). */}
      <header className="sticky top-0 z-50 bg-white">
        <nav className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 py-3 text-sm">
          <NavLinks
            isAdmin={!!profile?.is_admin}
            pendingCount={pendingCount}
            unapprovedCount={unapprovedCount}
          />
          <Link href="/profile" className="ml-auto hidden text-neutral-500 hover:underline md:inline">{profile?.display_name}</Link>
          <form action={logout} className="hidden md:block">
            <button className="hover:underline">Odhlásit</button>
          </form>
        </nav>
      </header>
      <div className="mx-auto max-w-7xl px-4 py-6">{children}</div>
    </>
  );
}
