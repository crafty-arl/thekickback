import { createClient as createAuthClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { cancelCalBooking } from "@/lib/cal";
import { sendEmail, wrap } from "@/lib/email";

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function POST(request: Request) {
  // Authenticate user
  const authClient = await createAuthClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { bookingId } = await request.json();
  if (!bookingId) {
    return Response.json({ error: "Missing bookingId" }, { status: 400 });
  }

  // Find the booking — must belong to this user (by email)
  const { data: booking, error: findErr } = await supabase
    .from("venue_bookings")
    .select("*, venues(name, cal_api_key)")
    .eq("id", bookingId)
    .single();

  if (findErr || !booking) {
    return Response.json({ error: "Booking not found" }, { status: 404 });
  }

  // Verify ownership: guest email must match user's email
  if (booking.guest_email !== user.email) {
    return Response.json({ error: "Not your booking" }, { status: 403 });
  }

  // Already cancelled
  if (booking.cal_status === "cancelled") {
    return Response.json({ error: "Booking is already cancelled" }, { status: 400 });
  }

  // Cancel on Cal.com if we have a uid
  if (booking.cal_booking_uid) {
    const venue = booking.venues as { name?: string; cal_api_key?: string } | null;
    const calKey = venue?.cal_api_key || process.env.CAL_API_KEY;
    if (calKey) {
      const calResult = await cancelCalBooking(calKey, booking.cal_booking_uid);
      if ("error" in calResult) {
        console.error("Cal.com cancel error:", calResult.error);
      }
    }
  }

  // Update local booking status
  await supabase
    .from("venue_bookings")
    .update({ cal_status: "cancelled" })
    .eq("id", bookingId);

  // Mark related pending_fulfillments as fulfilled (cancelled)
  if (booking.cal_booking_uid) {
    await supabase
      .from("pending_fulfillments")
      .update({ fulfilled: true })
      .eq("reference_id", booking.cal_booking_uid)
      .eq("type", "booking");
  }

  // Send cancellation email
  if (booking.guest_email) {
    try {
      const vName = (booking.venues as { name?: string } | null)?.name || "Venue";
      const oName = booking.offering_name || "Booking";
      const startDate = booking.starts_at ? new Date(booking.starts_at) : null;
      const dateStr = startDate
        ? startDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
        : "N/A";
      const timeStr = startDate
        ? startDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
        : "";

      sendEmail(
        booking.guest_email,
        `Booking cancelled — ${oName} at ${vName}`,
        wrap(`
          <div style="background:linear-gradient(135deg,rgba(139,92,246,0.15),rgba(139,92,246,0.05));border-radius:16px;padding:32px;text-align:center;margin-bottom:24px;">
            <div style="font-size:36px;margin-bottom:8px;">&#10060;</div>
            <h1 style="margin:0;font-size:24px;color:#fff;">Booking cancelled</h1>
          </div>
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <tr><td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.5);">Venue</td><td style="text-align:right;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:#fff;font-weight:600;">${vName}</td></tr>
            <tr><td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.5);">Service</td><td style="text-align:right;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:#fff;">${oName}</td></tr>
            <tr><td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.5);">Date</td><td style="text-align:right;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:#fff;">${dateStr}</td></tr>
            ${timeStr ? `<tr><td style="padding:10px 0;color:rgba(255,255,255,0.5);">Time</td><td style="text-align:right;padding:10px 0;color:#fff;">${timeStr}</td></tr>` : ""}
          </table>
          <div style="background:rgba(139,92,246,0.1);border:1px solid rgba(139,92,246,0.2);border-radius:12px;padding:12px 16px;margin-top:20px;text-align:center;">
            <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.6);">Your booking has been cancelled. No charges apply.</p>
          </div>
        `)
      );
    } catch (e) {
      console.error("Cancellation email failed:", e);
    }
  }

  return Response.json({ ok: true });
}
