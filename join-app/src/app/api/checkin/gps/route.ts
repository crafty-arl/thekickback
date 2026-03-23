import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const service = createServiceClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

export async function POST(request: Request) {
  const { venueId, latitude, longitude } = await request.json();

  if (!venueId || latitude == null || longitude == null) {
    return Response.json({ error: "Missing venueId, latitude, or longitude" }, { status: 400 });
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
    return Response.json({
      ok: true,
      checkinId: recentCheckin.id,
      xp: { xp: 0, venue_xp_total: 0, milestone: null, milestone_changed: false },
      message: "Already checked in recently",
    });
  }

  // Fetch venue with coordinates and radius
  const { data: venue } = await service
    .from("venues")
    .select("id, name, latitude, longitude, check_in_radius_meters")
    .eq("id", venueId)
    .eq("state", "active")
    .single();

  if (!venue) {
    return Response.json({ error: "Venue not found" }, { status: 404 });
  }

  if (venue.latitude == null || venue.longitude == null) {
    return Response.json({ error: "Venue has no coordinates configured" }, { status: 422 });
  }

  // Calculate distance
  const distance = haversineMeters(latitude, longitude, venue.latitude, venue.longitude);
  const maxRadius = venue.check_in_radius_meters ?? 100; // default 100m

  if (distance > maxRadius) {
    return Response.json(
      { error: "Too far", distance: Math.round(distance), maxRadius },
      { status: 403 }
    );
  }

  // Create session
  const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
  const { data: session } = await service
    .from("sessions")
    .insert({
      user_id: user.id,
      venue_id: venueId,
      status: "active",
      check_in_method: "gps",
      user_lat: latitude,
      user_lng: longitude,
      distance_meters: Math.round(distance),
      expires_at: expiresAt,
    })
    .select("id")
    .single();

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
      source: "gps",
      xp_granted: xpResult.xp || 0,
    })
    .select("id")
    .single();

  return Response.json({
    ok: true,
    checkinId: checkin?.id,
    sessionId: session?.id,
    xp: xpResult,
    distance: Math.round(distance),
    venueName: venue.name,
  });
}
