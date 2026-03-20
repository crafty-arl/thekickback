import { createClient } from "@supabase/supabase-js";
import { createCalBooking } from "@/lib/cal";

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
);

export async function POST(request: Request) {
    const body = await request.json();
    const { venueId, offeringId, start, attendeeName, attendeeEmail, attendeeTimezone } = body;

    if (!venueId || !offeringId || !start || !attendeeName || !attendeeEmail) {
        return Response.json(
            { error: "Missing required fields: venueId, offeringId, start, attendeeName, attendeeEmail" },
            { status: 400 }
        );
    }

    // Get venue's Cal.com API key
    const { data: venue } = await supabase
        .from("venues")
        .select("cal_api_key, name")
        .eq("id", venueId)
        .single();

    const calKey = venue?.cal_api_key || process.env.CAL_API_KEY;
    if (!calKey) {
        return Response.json({ error: "No Cal.com API key configured for this venue" }, { status: 400 });
    }

    // Get the offering with capacity and duration
    const { data: offering } = await supabase
        .from("venue_offerings")
        .select("cal_event_type_id, name, duration_minutes, capacity")
        .eq("id", offeringId)
        .eq("venue_id", venueId)
        .single();

    if (!offering?.cal_event_type_id) {
        return Response.json({ error: "This offering has no linked Cal.com event type" }, { status: 400 });
    }

    // ─── Overbooking check ───────────────────────────────────────
    // Check how many confirmed bookings already exist for this offering
    // during the requested time window
    const duration = offering.duration_minutes || 30;
    const requestedStart = new Date(start);
    const requestedEnd = new Date(requestedStart.getTime() + duration * 60000);

    const { count: overlapping } = await supabase
        .from("venue_bookings")
        .select("id", { count: "exact", head: true })
        .eq("venue_id", venueId)
        .eq("offering_id", offeringId)
        .in("cal_status", ["confirmed", "accepted", "pending"])
        .lt("starts_at", requestedEnd.toISOString())
        .gte(
            "ends_at",
            requestedStart.toISOString()
        );

    // If no ends_at stored, also check bookings that start during our window
    // (covers bookings where ends_at wasn't returned by Cal.com)
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

    // ─── Create booking on Cal.com ───────────────────────────────
    const result = await createCalBooking(calKey, {
        eventTypeId: offering.cal_event_type_id,
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

    // Save booking locally for dashboard visibility
    await supabase.from("venue_bookings").insert({
        venue_id: venueId,
        offering_id: offeringId,
        cal_booking_id: result.id,
        cal_booking_uid: result.uid,
        cal_status: result.status || "confirmed",
        offering_name: offering.name,
        guest_name: attendeeName,
        guest_email: attendeeEmail,
        starts_at: result.start,
        ends_at: result.end,
        duration_minutes: duration,
    }).then(({ error }) => {
        if (error) console.error("Failed to save booking locally:", error.message);
    });

    return Response.json({
        booking: result,
        message: `Booked "${offering.name}" at ${venue?.name}`,
        availability: {
            booked: totalOverlapping + 1,
            capacity: maxCapacity,
        },
    });
}
