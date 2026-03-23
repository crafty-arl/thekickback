import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createService } from "@supabase/supabase-js";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { venueId, status } = await req.json();
  if (!venueId || !["approved", "draft"].includes(status)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const service = createService(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );

  // Verify ownership
  const { data: ownership } = await service
    .from("venue_owners")
    .select("venue_id")
    .eq("user_id", user.id)
    .eq("venue_id", venueId)
    .single();

  if (!ownership) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  // Update review status on venue_pages
  const { error: pageError } = await service
    .from("venue_pages")
    .update({ review_status: status, published: status === "approved" })
    .eq("venue_id", venueId);

  if (pageError) {
    return NextResponse.json({ error: pageError.message }, { status: 500 });
  }

  // Update venue state
  const { error: venueError } = await service
    .from("venues")
    .update({ state: status === "approved" ? "active" : "inactive" })
    .eq("id", venueId);

  if (venueError) {
    return NextResponse.json({ error: venueError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, status });
}
