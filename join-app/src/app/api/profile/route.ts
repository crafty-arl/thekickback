import { NextRequest, NextResponse } from "next/server";
import { createClient as createAuthClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
);

// GET /api/profile — fetch profile
export async function GET() {
  const authClient = await createAuthClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, email, phone, created_at")
    .eq("id", user.id)
    .single();

  return NextResponse.json({ profile });
}

// PATCH /api/profile — update display name
export async function PATCH(req: NextRequest) {
  const authClient = await createAuthClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json();
  const { displayName } = body;

  if (typeof displayName !== "string" || displayName.length > 50) {
    return NextResponse.json({ error: "Invalid display name" }, { status: 400 });
  }

  const trimmed = displayName.trim() || null;

  const { error } = await supabase
    .from("profiles")
    .update({ display_name: trimmed, updated_at: new Date().toISOString() })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, displayName: trimmed });
}

// DELETE /api/profile — delete account
export async function DELETE() {
  const authClient = await createAuthClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  // Clear user data from app tables (cascade handles most)
  await supabase.from("user_preferences").delete().eq("user_id", user.id);
  await supabase.from("user_devices").delete().eq("user_id", user.id);
  await supabase.from("chat_threads").delete().eq("user_id", user.id);
  await supabase.from("user_venue_xp").delete().eq("user_id", user.id);

  // Delete auth user (cascades to profiles via FK)
  const { error } = await supabase.auth.admin.deleteUser(user.id);
  if (error) {
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
