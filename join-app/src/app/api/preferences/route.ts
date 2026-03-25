import { NextRequest, NextResponse } from "next/server";
import { createClient as createAuthClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function getAuthUserId(): Promise<string | null> {
  const authClient = await createAuthClient();
  const { data: { user } } = await authClient.auth.getUser();
  return user?.id || null;
}

// GET — fetch user memory
export async function GET() {
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data } = await supabase
    .from("profiles")
    .select("memory")
    .eq("id", userId)
    .single();

  return NextResponse.json({ memory: data?.memory || "" });
}

// PUT — update user memory
export async function PUT(req: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { memory } = await req.json();
  if (typeof memory !== "string") return NextResponse.json({ error: "memory must be a string" }, { status: 400 });

  const { error } = await supabase
    .from("profiles")
    .update({ memory: memory.slice(0, 2000) })
    .eq("id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE — clear user memory
export async function DELETE() {
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { error } = await supabase
    .from("profiles")
    .update({ memory: "" })
    .eq("id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
