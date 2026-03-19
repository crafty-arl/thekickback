/**
 * Cal.com API v2 helpers
 * Creates bookings via Cal.com REST API for AI-driven reservations.
 */

const CAL_API_BASE = "https://api.cal.com/v2";
const CAL_API_VERSION = "2024-06-14";

function calHeaders(apiKey: string) {
    return {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "cal-api-version": CAL_API_VERSION,
    };
}

export async function createCalBooking(
    apiKey: string,
    data: {
        eventTypeId: number;
        start: string;
        attendeeName: string;
        attendeeEmail: string;
        attendeeTimezone: string;
        metadata?: Record<string, unknown>;
    }
): Promise<
    | { id: number; uid: string; status: string; start: string; end: string }
    | { error: string }
> {
    try {
        const res = await fetch(`${CAL_API_BASE}/bookings`, {
            method: "POST",
            headers: calHeaders(apiKey),
            body: JSON.stringify({
                eventTypeId: data.eventTypeId,
                start: data.start,
                attendee: {
                    name: data.attendeeName,
                    email: data.attendeeEmail,
                    timeZone: data.attendeeTimezone,
                    language: "en",
                },
                metadata: data.metadata || {},
            }),
        });

        if (!res.ok) {
            const text = await res.text();
            console.error("Cal.com create booking error:", res.status, text);
            return { error: `Cal.com error ${res.status}: ${text}` };
        }

        const json = await res.json();
        const d = json.data;
        return {
            id: d.id,
            uid: d.uid,
            status: d.status,
            start: d.start,
            end: d.end,
        };
    } catch (err) {
        console.error("Cal.com create booking fetch error:", err);
        return { error: String(err) };
    }
}
