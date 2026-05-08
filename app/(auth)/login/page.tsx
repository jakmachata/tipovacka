import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PasswordInput } from "@/components/password-input";

export default function LoginPage() {
  async function login(formData: FormData) {
    "use server";
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: String(formData.get("email")),
      password: String(formData.get("password")),
    });
    if (error) return redirect(`/login?error=${encodeURIComponent(error.message)}`);
    redirect("/schedule");
  }

  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-4xl font-extrabold tracking-tight">Natipovals?</h1>
      <p className="mb-8 text-sm text-neutral-500">Přihlášení</p>
      <form action={login} className="space-y-4">
        <input
          name="email"
          type="email"
          placeholder="email"
          required
          className="w-full rounded border px-3 py-2"
        />
        <PasswordInput name="password" placeholder="heslo" required />
        <button className="w-full rounded bg-black px-4 py-2 text-white">
          Přihlásit
        </button>
      </form>
      <p className="mt-6 text-sm text-neutral-600">
        Účet ještě nemáš?{" "}
        <Link href="/register" className="underline">
          Zaregistrovat se
        </Link>
      </p>
      <p className="mt-2 text-sm">
        <span className="rounded bg-rose-100 px-2 py-0.5 text-rose-800">
          Zapomenuté heslo (zatím nefunkční - kontaktuj Kubu)
        </span>
      </p>
    </main>
  );
}
