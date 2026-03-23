import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { createClient as createAuthClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { isSandboxServer } from "@/lib/sandbox";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function POST() {
  const authClient = await createAuthClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const h = await headers();
  const mode = isSandboxServer(h) ? "test" : "live";

  const { error } = await supabase
    .from("user_wallets")
    .update({ spent_this_period_cents: 0 })
    .eq("user_id", user.id)
    .eq("mode", mode)
    .eq("active", true);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
