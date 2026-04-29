import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export default async function AdminUsersPage() {
  const supabase = await createClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .order("is_approved", { ascending: true })
    .order("created_at", { ascending: false });

  async function setFlag(formData: FormData) {
    "use server";
    const sb = await createClient();
    const id = String(formData.get("id"));
    const field = String(formData.get("field"));     // is_approved | has_paid | is_admin
    const value = formData.get("value") === "true";
    if (!["is_approved", "has_paid", "is_admin"].includes(field)) return;
    await sb.from("profiles").update({ [field]: value }).eq("id", id);
    revalidatePath("/admin/users");
  }

  return (
    <main>
      <h1 className="mb-4 text-xl font-semibold">Hráči</h1>
      <table className="w-full text-sm">
        <thead className="border-b text-left text-neutral-500">
          <tr>
            <th className="py-2">Přezdívka</th>
            <th>Schválen</th>
            <th>Zaplatil</th>
            <th>Admin</th>
          </tr>
        </thead>
        <tbody>
          {(profiles ?? []).map((p: any) => (
            <tr key={p.id} className="border-b">
              <td className="py-2 font-medium">{p.display_name}</td>
              {(["is_approved", "has_paid", "is_admin"] as const).map((field) => (
                <td key={field}>
                  <form action={setFlag} className="inline">
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="field" value={field} />
                    <input type="hidden" name="value" value={(!p[field]).toString()} />
                    <button
                      className={
                        p[field]
                          ? "rounded bg-emerald-100 px-2 py-1 text-emerald-800"
                          : "rounded bg-neutral-100 px-2 py-1 text-neutral-600"
                      }
                    >
                      {p[field] ? "✓ ano" : "— ne"}
                    </button>
                  </form>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
