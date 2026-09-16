"use server";
import { redirect } from "next/navigation";
import { supabase, configured } from "@/lib/supabase";
export async function login(form: FormData) {
  if (!configured()) redirect("/login?error=setup");
  const db = await supabase();
  const { error } = await db.auth.signInWithPassword({
    email: String(form.get("email")),
    password: String(form.get("password")),
  });
  if (error) redirect("/login?error=credentials");
  redirect("/");
}
export async function logout() {
  if (configured()) {
    const db = await supabase();
    await db.auth.signOut();
  }
  redirect("/login");
}
