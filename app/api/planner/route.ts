import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { readPlannerPool } from "@/lib/planner-data";

export async function GET() {
  try {
    const db = await supabase();
    const { data: { user } } = await db.auth.getUser();
    if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    const { data: staff } = await db.from("profiles").select("role").eq("id", user.id).single();
    if (!staff || !["admin", "moderator"].includes(staff.role)) return NextResponse.json({ error: "Moderator access required" }, { status: 403 });
    const { pool } = await readPlannerPool();
    return NextResponse.json({ pool }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unable to load reference roster" }, { status: 503 });
  }
}
