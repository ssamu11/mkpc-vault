import { redirect } from "next/navigation";
import { configured, supabase } from "@/lib/supabase";
import { readCatalog } from "@/lib/data";
import Workspace from "@/components/workspace";
export const dynamic = "force-dynamic";
export default async function Page() {
  if (!configured()) redirect("/login");
  const db = await supabase();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await db
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile) redirect("/login?error=access");
  const data = await readCatalog();
  return (
    <Workspace
      initial={data}
      email={user.email || "Moderator"}
      role={profile.role}
    />
  );
}
