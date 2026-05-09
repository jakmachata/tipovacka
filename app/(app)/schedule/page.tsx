import { redirect } from "next/navigation";

// /schedule URL je legacy — přesměruj na nový kanonický /.
export default function ScheduleLegacyRedirect() {
  redirect("/");
}
