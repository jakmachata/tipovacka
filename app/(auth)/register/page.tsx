import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default function RegisterPage() {
  async function register(formData: FormData) {
    "use server";
    const supabase = await createClient();
    const email = String(formData.get("email"));
    const password = String(formData.get("password"));

    const { error } = await supabase.auth.signUp({ email, password });
    if (error) return redirect(`/register?error=${encodeURIComponent(error.message)}`);

    // V Supabase projektech bez "Confirm email" rovnou login;
    // jinak Supabase pošle confirmation mail a uživatel potvrdí.
    redirect("/pending");
  }

  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <h1 className="mb-2 text-3xl font-bold">Registrace</h1>
      <p className="mb-8 text-sm text-neutral-600">
        Po registraci tě musí Kuba schválit a přidělit ti přezdívku, než začneš tipovat.
      </p>
      <form action={register} className="space-y-4">
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
          placeholder="heslo (min. 6 znaků)"
          minLength={6}
          required
          className="w-full rounded border px-3 py-2"
        />
        <button className="w-full rounded bg-black px-4 py-2 text-white">
          Vytvořit účet
        </button>
      </form>
      <p className="mt-6 text-sm text-neutral-600">
        Už máš účet?{" "}
        <Link href="/login" className="underline">
          Přihlásit se
        </Link>
      </p>
    </main>
  );
}
