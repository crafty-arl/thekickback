import { headers } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { createCalBooking } from "@/lib/cal";
import { isSandboxServer } from "@/lib/sandbox";
import { sendEmail, wrap } from "@/lib/email";

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
);

export async function POST(request: Request) {
    const body = await request.json();
    const { venueId, offeringId, start, attendeeName, attendeeEmail, attendeeTimezone, staffId } = body;

    if (!venueId || !offeringId || !start || !attendeeName || !attendeeEmail) {
        return Response.json(
            { error: "Missing required fields: venueId, offeringId, start, attendeeName, attendeeEmail" },
            { status: 400 }
        );
    }

    // Get venue info
    const { data: venue } = await supabase
        .from("venues")
        .select("cal_api_key, name")
        .eq("id", venueId)
        .single();

    const calKey = venue?.cal_api_key || process.env.CAL_API_KEY;

    // Get the offering with capacity and duration
    const { data: offering } = await supabase
        .from("venue_offerings")
        .select("cal_event_type_id, name, duration_minutes, capacity")
        .eq("id", offeringId)
        .eq("venue_id", venueId)
        .single();

    if (!offering) {
        return Response.json({ error: "Offering not found" }, { status: 404 });
    }

    const duration = offering.duration_minutes || 30;
    const requestedStart = new Date(start);
    const requestedEnd = new Date(requestedStart.getTime() + duration * 60000);

    // ─── Overbooking check ───────────────────────────────────────
    if (staffId) {
        const { count: staffConflicts } = await supabase
            .from("venue_bookings")
            .select("id", { count: "exact", head: true })
            .eq("staff_id", staffId)
            .in("cal_status", ["confirmed", "accepted", "pending"])
            .lt("starts_at", requestedEnd.toISOString())
            .gte("ends_at", requestedStart.toISOString());

        const { count: staffConflictsByStart } = await supabase
            .from("venue_bookings")
            .select("id", { count: "exact", head: true })
            .eq("staff_id", staffId)
            .in("cal_status", ["confirmed", "accepted", "pending"])
            .is("ends_at", null)
            .gte("starts_at", requestedStart.toISOString())
            .lt("starts_at", requestedEnd.toISOString());

        if ((staffConflicts || 0) + (staffConflictsByStart || 0) > 0) {
            return Response.json({
                error: "This staff member is already booked at that time. Please pick a different time or staff member.",
                fully_booked: true,
            }, { status: 409 });
        }
    }

    // Offering-level capacity check
    const { count: overlapping } = await supabase
        .from("venue_bookings")
        .select("id", { count: "exact", head: true })
        .eq("venue_id", venueId)
        .eq("offering_id", offeringId)
        .in("cal_status", ["confirmed", "accepted", "pending"])
        .lt("starts_at", requestedEnd.toISOString())
        .gte("ends_at", requestedStart.toISOString());

    const { count: overlappingByStart } = await supabase
        .from("venue_bookings")
        .select("id", { count: "exact", head: true })
        .eq("venue_id", venueId)
        .eq("offering_id", offeringId)
        .in("cal_status", ["confirmed", "accepted", "pending"])
        .is("ends_at", null)
        .gte("starts_at", requestedStart.toISOString())
        .lt("starts_at", requestedEnd.toISOString());

    const totalOverlapping = (overlapping || 0) + (overlappingByStart || 0);
    const maxCapacity = offering.capacity || 1;

    if (totalOverlapping >= maxCapacity) {
        return Response.json({
            error: "This time slot is fully booked. Please pick a different time.",
            fully_booked: true,
            booked: totalOverlapping,
            capacity: maxCapacity,
        }, { status: 409 });
    }

    // ─── Determine booking mode: Cal.com or native ───────────────
    const useCalcom = calKey && offering.cal_event_type_id;
    let bookingResult: { id?: number; uid: string; status: string; start: string; end: string };

    if (useCalcom) {
        // ─── Cal.com booking ─────────────────────────────────────
        const result = await createCalBooking(calKey, {
            eventTypeId: offering.cal_event_type_id!,
            start,
            attendeeName,
            attendeeEmail,
            attendeeTimezone: attendeeTimezone || "America/Chicago",
            metadata: {
                venueId,
                venueName: venue?.name,
                offeringName: offering.name,
                source: "kickback-ai",
            },
        });

        if ("error" in result) {
            return Response.json({ error: result.error }, { status: 502 });
        }

        bookingResult = result;
    } else {
        // ─── Native booking (no Cal.com) ─────────────────────────
        const uid = crypto.randomUUID();
        bookingResult = {
            uid,
            status: "confirmed",
            start: requestedStart.toISOString(),
            end: requestedEnd.toISOString(),
        };
    }

    // Look up staff name
    let staffName: string | null = null;
    if (staffId) {
        const { data: staffMember } = await supabase
            .from("venue_staff")
            .select("display_name")
            .eq("id", staffId)
            .single();
        staffName = staffMember?.display_name || null;
    }

    // Save booking locally
    const h = await headers();
    const mode = isSandboxServer(h) ? "test" : "live";
    await supabase.from("venue_bookings").insert({
        venue_id: venueId,
        offering_id: offeringId,
        cal_booking_id: useCalcom ? bookingResult.id : null,
        cal_booking_uid: bookingResult.uid,
        cal_status: bookingResult.status,
        offering_name: offering.name,
        guest_name: attendeeName,
        guest_email: attendeeEmail,
        starts_at: bookingResult.start,
        ends_at: bookingResult.end,
        duration_minutes: duration,
        staff_id: staffId || null,
        mode,
    }).then(({ error }) => {
        if (error) console.error("Failed to save booking locally:", error.message);
    });

    // Insert pending fulfillment for wallet pass
    if (body.userId) {
        await supabase.from("pending_fulfillments").insert({
            user_id: body.userId,
            venue_id: venueId,
            type: "booking",
            reference_id: bookingResult.uid || bookingResult.id?.toString() || "",
            label: `${offering.name} @ ${venue?.name || "Venue"}`,
        });
    }

    // Send booking confirmation email
    if (attendeeEmail) {
        try {
            const vName = venue?.name || "Venue";
            const oName = offering.name || "Booking";
            const startDate = new Date(bookingResult.start);
            const endDate = new Date(bookingResult.end);
            const dateStr = startDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
            const startTime = startDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
            const endTime = endDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
            sendEmail(attendeeEmail, `You're booked — ${oName} at ${vName}`, wrap(`
              <div style="background:linear-gradient(135deg,rgba(139,92,246,0.15),rgba(139,92,246,0.05));border-radius:16px;padding:32px;text-align:center;margin-bottom:24px;">
                <div style="font-size:36px;margin-bottom:8px;">&#128197;</div>
                <h1 style="margin:0;font-size:24px;color:#fff;">You're booked.</h1>
              </div>
              <table style="width:100%;border-collapse:collapse;font-size:14px;">
                <tr><td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.5);">Venue</td><td style="text-align:right;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:#fff;font-weight:600;">${vName}</td></tr>
                <tr><td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.5);">Service</td><td style="text-align:right;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:#fff;">${oName}</td></tr>
                <tr><td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.5);">Date</td><td style="text-align:right;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:#fff;">${dateStr}</td></tr>
                <tr><td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.5);">Time</td><td style="text-align:right;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:#fff;">${startTime} &ndash; ${endTime}</td></tr>
                <tr><td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.5);">Duration</td><td style="text-align:right;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:#fff;">${duration} min</td></tr>
                ${staffName ? `<tr><td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.5);">With</td><td style="text-align:right;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:#fff;">${staffName}</td></tr>` : ""}
                <tr><td style="padding:10px 0;color:rgba(255,255,255,0.5);">Guest</td><td style="text-align:right;padding:10px 0;color:#fff;">${attendeeName}</td></tr>
              </table>
              <div style="background:rgba(139,92,246,0.1);border:1px solid rgba(139,92,246,0.2);border-radius:12px;padding:12px 16px;margin-top:20px;text-align:center;">
                <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.6);">We'll hold your spot for 15 minutes. Don't be late.</p>
              </div>
            `));
        } catch (e) { console.error("Booking email failed:", e); }
    }

    return Response.json({
        booking: bookingResult,
        message: `Booked "${offering.name}" at ${venue?.name}${staffName ? ` with ${staffName}` : ""}`,
        staffName,
        availability: {
            booked: totalOverlapping + 1,
            capacity: maxCapacity,
        },
    });
}
