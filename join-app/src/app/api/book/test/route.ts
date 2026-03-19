import { createClient } from "@supabase/supabase-js";
import { createCalBooking } from "@/lib/cal";

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
);

/**
 * GET /api/book/test
 * Test endpoint — creates a booking for carl@craftthefuture.xyz
 * Remove after testing.
 */
export async function GET() {
    const calKey = process.env.CAL_API_KEY;
    if (!calKey) {
        return Response.json({ error: "CAL_API_KEY not set" }, { status: 500 });
    }

    // Find any offering with a cal_event_type_id
    const { data: offering } = await supabase
        .from("venue_offerings")
        .select("id, name, cal_event_type_id, venue_id")
        .not("cal_event_type_id", "is", null)
        .limit(1)
        .single();

    if (!offering?.cal_event_type_id) {
        return Response.json(
            { error: "No offerings with cal_event_type_id found. Create an offering on the dashboard first." },
            { status: 404 }
        );
    }

    // Book 24h from now
    const start = new Date(Date.now() + 24 * 60 * 60 * 1000);
    start.setMinutes(0, 0, 0);

    const result = await createCalBooking(calKey, {
        eventTypeId: offering.cal_event_type_id,
        start: start.toISOString(),
        attendeeName: "Carl (Test)",
        attendeeEmail: "carl@craftthefuture.xyz",
        attendeeTimezone: "America/Chicago",
        metadata: {
            source: "kickback-test",
            offeringId: offering.id,
        },
    });

    if ("error" in result) {
        return Response.json({ error: result.error }, { status: 502 });
    }

    return Response.json({
        message: `Test booking created for "${offering.name}"`,
        booking: result,
    });
}
