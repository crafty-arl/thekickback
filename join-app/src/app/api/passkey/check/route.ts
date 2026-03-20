import { NextResponse } from "next/server";
import { createClient as createAuthClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// GET — check if user has any registered passkeys
export async function GET() {
  const authClient = await createAuthClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { count } = await supabase
    .from("user_passkeys")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  return NextResponse.json({ hasPasskey: (count || 0) > 0, count: count || 0 });
}
