import { NextRequest, NextResponse } from "next/server";
import { createClient as createAuthClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail, wrap } from "@/lib/email";

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

  // ─── RSVP Confirmation Email ───────────────────────────────────
  try {
    const rsvpStatus = status || "going";
    if (rsvpStatus === "going") {
      const { data: profile } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", user.id)
        .single();

      if (profile?.email) {
        const { data: offering } = await supabase
          .from("venue_offerings")
          .select("name, venue_id")
          .eq("id", offeringId)
          .single();

        if (offering) {
          const { data: venue } = await supabase
            .from("venues")
            .select("name, slug")
            .eq("id", offering.venue_id)
            .single();

          const venueName = venue?.name || "the venue";
          const venueSlug = venue?.slug || offering.venue_id;
          const rsvpCount = data?.rsvp_count || null;

          // Try to find the next upcoming slot for this event
          const { data: nextSlot } = await supabase
            .from("offering_slots")
            .select("starts_at")
            .eq("offering_id", offeringId)
            .gt("starts_at", new Date().toISOString())
            .order("starts_at", { ascending: true })
            .limit(1)
            .maybeSingle();

          const dateBlock = nextSlot?.starts_at
            ? `<tr><td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.5);">When</td><td style="text-align:right;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:#fff;">${new Date(nextSlot.starts_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} &middot; ${new Date(nextSlot.starts_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</td></tr>`
            : "";

          const countBlock = rsvpCount
            ? `<tr><td style="padding:10px 0;color:rgba(255,255,255,0.5);">Going</td><td style="text-align:right;padding:10px 0;color:#4ADE80;font-weight:600;">${rsvpCount} people</td></tr>`
            : "";

          sendEmail(profile.email, `You're on the list — ${offering.name}`, wrap(`
            <div style="background:linear-gradient(135deg,rgba(139,92,246,0.2),rgba(139,92,246,0.05));border-radius:16px;padding:32px;text-align:center;margin-bottom:24px;">
              <div style="font-size:36px;margin-bottom:8px;">&#127881;</div>
              <h1 style="margin:0;font-size:28px;color:#fff;">You're on the list.</h1>
            </div>
            <table style="width:100%;border-collapse:collapse;font-size:14px;">
              <tr><td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.5);">Event</td><td style="text-align:right;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:#fff;font-weight:600;">${offering.name}</td></tr>
              <tr><td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.5);">Venue</td><td style="text-align:right;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:#fff;">${venueName}</td></tr>
              ${dateBlock}
              ${countBlock}
            </table>
            <div style="text-align:center;margin-top:20px;">
              <a href="https://join.thekickback.net/${venueSlug}" style="display:inline-block;padding:12px 28px;background:#8B5CF6;color:#fff;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;">View venue</a>
            </div>
          `));
        }
      }
    }
  } catch (e) { console.error("RSVP email failed:", e); }

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
