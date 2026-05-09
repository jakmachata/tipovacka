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
        {/* Mobile-only fixed login bar nahoře — registrace/login je vždy úplně na vrchu. */}
        <div className="fixed inset-x-0 top-0 z-[51] border-b bg-white transform-gpu md:hidden">
          <div className="mx-auto flex h-[32px] max-w-7xl items-center px-4 text-sm">
            <GuestHeader />
          </div>
        </div>
        {/* Menu — fixed pod mobile login barem (mobil) nebo úplně nahoře (desktop). */}
        <header className="fixed inset-x-0 top-[32px] md:top-0 z-50 border-b bg-white transform-gpu">
          <div className="mx-auto flex h-[48px] max-w-7xl items-center px-4">
            <nav className="flex flex-1 items-center gap-2 overflow-x-auto whitespace-nowrap text-sm">
              <NavLinks isAdmin={false} pendingCount={0} unapprovedCount={0} guest />
            </nav>
            <div className="hidden flex-shrink-0 items-center gap-2 pl-2 md:flex">
              <GuestHeader />
            </div>
          </div>
        </header>
        <div className="h-[80px] md:h-[48px]" />
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
      {/* Mobile-only fixed login info bar nahoře — uživatelská část je vždy úplně na vrchu. */}
      <div className="fixed inset-x-0 top-0 z-[51] border-b bg-white transform-gpu md:hidden">
        <div className="mx-auto flex h-[32px] max-w-7xl items-center gap-3 px-4 text-sm">
          <span className="font-bold text-neutral-700">{profile?.display_name}</span>
          <Link href="/profile" className="text-neutral-500 hover:underline">Nastavení</Link>
          <form action={logout}>
            <button className="text-neutral-500 hover:underline">Odhlásit</button>
          </form>
        </div>
      </div>
      {/* Menu — fixed pod mobile login barem (mobil) nebo úplně nahoře (desktop).
          Na desktopu má login info v pevném panelu napravo. */}
      <header className="fixed inset-x-0 top-[32px] md:top-0 z-50 border-b bg-white transform-gpu">
        <div className="mx-auto flex h-[48px] max-w-7xl items-center px-4">
          <nav className="flex flex-1 items-center gap-2 overflow-x-auto whitespace-nowrap text-sm">
            <NavLinks
              isAdmin={!!profile?.is_admin}
              pendingCount={pendingCount}
              unapprovedCount={unapprovedCount}
            />
          </nav>
          <div className="hidden flex-shrink-0 items-center gap-2 pl-2 text-sm md:flex">
            <span className="font-bold text-neutral-700">{profile?.display_name}</span>
            <Link href="/profile" className="text-neutral-500 hover:underline">Nastavení</Link>
            <form action={logout}>
              <button className="text-neutral-500 hover:underline">Odhlásit</button>
            </form>
          </div>
        </div>
      </header>
      <div className="h-[80px] md:h-[48px]" />
      <div className="mx-auto max-w-7xl px-4 py-6">{children}</div>
    </>
  );
}
