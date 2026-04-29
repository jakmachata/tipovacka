import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default function LoginPage() {
  async function login(formData: FormData) {
    "use server";
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: String(formData.get("email")),
      password: String(formData.get("password")),
    });
    if (error) return redirect(`/auth/login?error=${encodeURIComponent(error.message)}`);
    redirect("/schedule");
  }

  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <h1 className="mb-8 text-3xl font-bold">Tipovačka — přihlášení</h1>
      <form action={login} className="space-y-4">
        <input
          name="email"
          type="email"
          placeholder="email"
          required
          className="w-full rounded border px-3 py-2"
        />
        <input
          name="password"
          type="password"
          placeholder="heslo"
          required
          className="w-full rounded border px-3 py-2"
        />
        <button className="w-full rounded bg-black px-4 py-2 text-white">
          Přihlásit
        </button>
      </form>
      <p className="mt-6 text-sm text-neutral-600">
        Účet ještě nemáš?{" "}
        <Link href="/auth/register" className="underline">
          Zaregistrovat se
        </Link>
      </p>
    </main>
  );
}
