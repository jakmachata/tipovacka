import { redirect } from "next/navigation";

export default function Home() {
  // Schedule je veřejně přístupný (host, neschválený i schválený). Vždy redirect.
  redirect("/schedule");
}
