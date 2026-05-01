import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NavLinks } from "@/components/nav-links";

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
      <header className="sticky top-0 z-20 border-b bg-white">
        <nav className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-3 text-sm">
          <NavLinks isAdmin={!!profile.is_admin} />
          <span className="ml-auto text-neutral-500">{profile.display_name}</span>
          <form action={logout}><button className="hover:underline">Odhlásit</button></form>
        </nav>
      </header>
      <div className="mx-auto max-w-7xl px-4 py-6">{children}</div>
    </>
  );
}
