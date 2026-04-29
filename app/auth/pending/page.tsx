import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function PendingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, is_approved")
    .eq("id", user.id)
    .single();

  if (profile?.is_approved) return redirect("/schedule");

  async function logout() {
    "use server";
    const sb = await createClient();
    await sb.auth.signOut();
    redirect("/auth/login");
  }

  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <h1 className="mb-4 text-2xl font-semibold">Čekáme na schválení</h1>
      <p className="text-neutral-700">
        Ahoj {profile?.display_name}, tvůj účet vidí admin a brzy tě schválí.
        Pak budeš moct tipovat. Po schválení stačí stránku obnovit.
      </p>
      <form action={logout} className="mt-8">
        <button className="text-sm underline">Odhlásit se</button>
      </form>
    </main>
  );
}
