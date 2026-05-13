// Loop health for a single venue. Powers the Today tab loop-health panel.
// Auth: only the venue's owner can read.

import { NextRequest, NextResponse } from "next/server";
import { createClient as createAuthClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

const service = createServiceClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
);

export async function GET(req: NextRequest) {
  const venueId = req.nextUrl.searchParams.get("venueId");
  if (!venueId) {
    return NextResponse.json({ error: "venueId required" }, { status: 400 });
  }

  const supabase = await createAuthClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }

  // Authorize: this user must own the venue
  const { data: ownership } = await service
    .from("venue_owners")
    .select("venue_id")
    .eq("user_id", user.id)
    .eq("venue_id", venueId)
    .maybeSingle();

  if (!ownership) {
    return NextResponse.json({ error: "not authorized" }, { status: 403 });
  }

  const { data, error } = await service
    .from("loop_health_per_venue")
    .select("*")
    .eq("venue_id", venueId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // The view returns one row per venue; missing means the venue has no
  // loop_events yet — return a zeroed row so the UI can render.
  return NextResponse.json({
    health: data ?? {
      venue_id: venueId,
      venue_name: null,
      checkins_7d: 0,
      active_guests_7d: 0,
      returns_7d: 0,
      unprompted_returns_7d: 0,
      chat_cost_usd_7d: 0,
      redemptions_7d: 0,
      vibe_drops_7d: 0,
      chat_messages_7d: 0,
      chat_action_clicks_7d: 0,
      chat_cost_per_action_usd_7d: null,
      chat_action_rate_7d: null,
    },
  });
}
