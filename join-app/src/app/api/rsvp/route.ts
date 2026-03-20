import { NextRequest, NextResponse } from "next/server";
import { createClient as createAuthClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// POST /api/rsvp — RSVP to an event
export async function POST(request: Request) {
  const authClient = await createAuthClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { offeringId, status } = await request.json();
  if (!offeringId) return NextResponse.json({ error: "offeringId required" }, { status: 400 });

  const { data, error } = await supabase.rpc("rsvp_event", {
    p_user_id: user.id,
    p_offering_id: offeringId,
    p_status: status || "going",
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (data?.error) return NextResponse.json({ error: data.error }, { status: 400 });

  return NextResponse.json(data);
}

// GET /api/rsvp?offeringId=xxx — get RSVP status + count
export async function GET(req: NextRequest) {
  const authClient = await createAuthClient();
  const { data: { user } } = await authClient.auth.getUser();

  const offeringId = req.nextUrl.searchParams.get("offeringId");
  if (!offeringId) return NextResponse.json({ error: "offeringId required" }, { status: 400 });

  // Get RSVP count
  const { data: offering } = await supabase
    .from("venue_offerings")
    .select("rsvp_count, max_attendees")
    .eq("id", offeringId)
    .single();

  // Get user's RSVP status if authenticated
  let userStatus = null;
  if (user) {
    const { data: rsvp } = await supabase
      .from("event_rsvps")
      .select("status")
      .eq("user_id", user.id)
      .eq("offering_id", offeringId)
      .single();
    userStatus = rsvp?.status || null;
  }

  return NextResponse.json({
    rsvpCount: offering?.rsvp_count || 0,
    maxAttendees: offering?.max_attendees || null,
    userStatus,
  });
}
