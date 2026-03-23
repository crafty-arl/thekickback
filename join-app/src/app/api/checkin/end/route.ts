import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const service = createServiceClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function POST(request: Request) {
  const { sessionId, venueId } = await request.json();

  if (!sessionId && !venueId) {
    return Response.json({ error: "Missing sessionId or venueId" }, { status: 400 });
  }

  // Authenticate user
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Find active session
  let query = service
    .from("sessions")
    .select("id, user_id, venue_id, started_at, expires_at")
    .eq("user_id", user.id)
    .eq("status", "active");

  if (sessionId) {
    query = query.eq("id", sessionId);
  } else {
    query = query.eq("venue_id", venueId);
  }

  const { data: session } = await query
    .order("started_at", { ascending: false })
    .limit(1)
    .single();

  if (!session) {
    return Response.json({ error: "No active session found" }, { status: 404 });
  }

  // End the session
  const now = new Date().toISOString();
  await service
    .from("sessions")
    .update({ status: "ended", ended_at: now })
    .eq("id", session.id);

  // Calculate duration
  const startedAt = new Date(session.started_at).getTime();
  const endedAt = new Date(now).getTime();
  const durationMinutes = Math.round((endedAt - startedAt) / 60000);

  // Award "session_complete" XP if session lasted > 15 minutes
  let xpEarned = 0;
  if (durationMinutes > 15) {
    try {
      const { data } = await service.rpc("grant_venue_xp", {
        p_user_id: user.id,
        p_venue_id: session.venue_id,
        p_action: "session_complete",
      });
      if (data?.xp) xpEarned = data.xp;
    } catch (err) {
      console.error("[session-end] XP grant error:", err);
    }
  }

  return Response.json({
    ok: true,
    duration_minutes: durationMinutes,
    xp_earned: xpEarned,
  });
}
