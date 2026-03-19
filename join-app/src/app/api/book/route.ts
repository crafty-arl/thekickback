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

    // Get the offering's cal_event_type_id
    const { data: offering } = await supabase
        .from("venue_offerings")
        .select("cal_event_type_id, name")
        .eq("id", offeringId)
        .eq("venue_id", venueId)
        .single();

    if (!offering?.cal_event_type_id) {
        return Response.json({ error: "This offering has no linked Cal.com event type" }, { status: 400 });
    }

    // Create the booking on Cal.com
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

    return Response.json({
        booking: result,
        message: `Booked "${offering.name}" at ${venue?.name}`,
    });
}
