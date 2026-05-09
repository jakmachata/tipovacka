import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileEditForm } from "@/components/profile-edit-form";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, bg_color, text_color, is_admin")
    .eq("id", user.id)
    .single();

  return (
    <main>
      <h1 className="mb-4 text-2xl font-bold">Můj profil</h1>
      <ProfileEditForm
        userId={user.id}
        userEmail={user.email ?? ""}
        isAdmin={!!profile?.is_admin}
        initial={{
          name: profile?.display_name ?? "",
          bg: profile?.bg_color ?? "#dc2626",
          text: profile?.text_color ?? "#ffffff",
        }}
      />
    </main>
  );
}
