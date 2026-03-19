import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

const service = createServiceClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function POST(request: Request) {
  const { venueId, table } = await request.json();

  if (!venueId) {
    return Response.json({ error: "Missing venueId" }, { status: 400 });
  }

  // Authenticate user
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Anti-abuse: check for recent check-in at this venue (30 min cooldown)
  const { data: recentCheckin } = await service
    .from("checkins")
    .select("id, xp_granted, created_at")
    .eq("user_id", user.id)
    .eq("venue_id", venueId)
    .gte("created_at", new Date(Date.now() - 30 * 60 * 1000).toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (recentCheckin) {
    // Return existing check-in without granting new XP
    return Response.json({
      checkinId: recentCheckin.id,
      xp: { xp: 0, venue_xp_total: 0, milestone: null, milestone_changed: false },
      message: "Already checked in recently",
    });
  }

  // Verify venue exists and is active
  const { data: venue } = await service
    .from("venues")
    .select("id, occupancy")
    .eq("id", venueId)
    .eq("state", "active")
    .single();

  if (!venue) {
    return Response.json({ error: "Venue not found" }, { status: 404 });
  }

  // Create session
  const { data: session } = await service
    .from("sessions")
    .insert({ user_id: user.id, venue_id: venueId, status: "active" })
    .select("id")
    .single();

  // Update occupancy
  await service
    .from("venues")
    .update({ occupancy: venue.occupancy + 1 })
    .eq("id", venueId);

  // Grant venue XP
  let xpResult = { xp: 0, venue_xp_total: 0, milestone: null, milestone_changed: false };
  try {
    const { data } = await service.rpc("grant_venue_xp", {
      p_user_id: user.id,
      p_venue_id: venueId,
      p_action: "visit",
    });
    if (data) xpResult = data;
  } catch (err) {
    console.error("XP grant error:", err);
  }

  // Log check-in
  const { data: checkin } = await service
    .from("checkins")
    .insert({
      user_id: user.id,
      venue_id: venueId,
      session_id: session?.id || null,
      table_number: table || null,
      source: "qr",
      xp_granted: xpResult.xp || 0,
    })
    .select("id")
    .single();

  return Response.json({
    checkinId: checkin?.id,
    xp: xpResult,
  });
}
