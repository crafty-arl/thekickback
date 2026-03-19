import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// GET — fetch all preferences for a user
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const { data, error } = await supabase
    .from("user_preferences")
    .select("*")
    .eq("user_id", userId)
    .gte("confidence", 0.3)
    .order("category")
    .order("confidence", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Group by category
  const grouped: Record<string, typeof data> = {};
  for (const pref of data || []) {
    if (!grouped[pref.category]) grouped[pref.category] = [];
    grouped[pref.category].push(pref);
  }

  return NextResponse.json({ preferences: data || [], grouped });
}

// DELETE — remove a single preference
export async function DELETE(req: NextRequest) {
  const { id, userId } = await req.json();
  if (!id || !userId) return NextResponse.json({ error: "id and userId required" }, { status: 400 });

  const { error } = await supabase
    .from("user_preferences")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// PUT — confirm or update a preference
export async function PUT(req: NextRequest) {
  const { id, userId, value, confirmed } = await req.json();
  if (!id || !userId) return NextResponse.json({ error: "id and userId required" }, { status: 400 });

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (value !== undefined) updates.value = value;
  if (confirmed) {
    updates.confidence = 1.0;
    updates.source = "user";
  }

  const { error } = await supabase
    .from("user_preferences")
    .update(updates)
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
