import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { sendEmail, wrap } from "@/lib/email";

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

  // ─── Email 1: Milestone Unlocked (XP tier up) ──────────────────
  if (xpResult.milestone_changed && xpResult.milestone && user.email) {
    try {
      const { data: vData } = await service.from("venues").select("name, slug").eq("id", venueId).single();
      const vName = vData?.name || "Venue";
      const slug = vData?.slug || venueId;
      // Fetch perks for the new milestone
      const { data: milestoneRow } = await service.from("venue_xp_milestones")
        .select("id, name, perks, color")
        .eq("venue_id", venueId)
        .eq("name", xpResult.milestone)
        .single();
      const perksArr: string[] = milestoneRow?.perks || [];
      const perksHtml = perksArr.length > 0
        ? perksArr.map((p: string) =>
          `<div style="border-left:3px solid #F97316;padding:6px 12px;margin-bottom:8px;font-size:13px;color:rgba(255,255,255,0.7);">${p}</div>`
        ).join("")
        : "";
      sendEmail(user.email, `Level up — ${vName}`, wrap(`
        <div style="background:linear-gradient(135deg,#F97316,#FBBF24);border-radius:16px;padding:32px;text-align:center;margin-bottom:24px;">
          <h1 style="margin:0;font-size:28px;color:#000;font-weight:800;">Level up.</h1>
          <p style="margin:8px 0 0;font-size:16px;color:rgba(0,0,0,0.7);font-weight:600;">${xpResult.milestone}</p>
        </div>
        <div style="text-align:center;margin-bottom:20px;">
          <span style="font-size:36px;font-weight:800;color:#F97316;">${xpResult.venue_xp_total}</span>
          <span style="font-size:14px;color:rgba(255,255,255,0.5);margin-left:6px;">XP at ${vName}</span>
        </div>
        ${perksHtml ? `<div style="background:#111;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:16px;margin-bottom:20px;">
          <p style="margin:0 0 10px;font-size:12px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.5px;">Unlocked</p>
          ${perksHtml}
        </div>` : ""}
        <div style="text-align:center;margin-top:20px;">
          <a href="https://join.thekickback.net/${slug}" style="display:inline-block;padding:12px 28px;background:#F97316;color:#000;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;">View your perks</a>
        </div>
      `));
    } catch (e) { console.error("Milestone email failed:", e); }
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
