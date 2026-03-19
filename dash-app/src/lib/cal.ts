/**
 * Cal.com API v2 helpers
 * Creates/deletes event types and bookings via Cal.com REST API.
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

function slugify(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 48);
}

// ── Event Types ──────────────────────────────────────────────────

export async function createCalEventType(
    apiKey: string,
    data: {
        title: string;
        durationMinutes: number;
        description?: string;
        address?: string;
    }
): Promise<{ id: number; slug: string } | { error: string }> {
    try {
        const res = await fetch(`${CAL_API_BASE}/event-types`, {
            method: "POST",
            headers: calHeaders(apiKey),
            body: JSON.stringify({
                title: data.title,
                slug: slugify(data.title),
                lengthInMinutes: data.durationMinutes || 30,
                description: data.description || "",
                locations: data.address
                    ? [{ type: "address", address: data.address, public: true }]
                    : [],
            }),
        });

        if (!res.ok) {
            const text = await res.text();
            console.error("Cal.com create event type error:", res.status, text);
            return { error: `Cal.com error ${res.status}: ${text}` };
        }

        const json = await res.json();
        return { id: json.data.id, slug: json.data.slug };
    } catch (err) {
        console.error("Cal.com create event type fetch error:", err);
        return { error: String(err) };
    }
}

export async function deleteCalEventType(
    apiKey: string,
    eventTypeId: number
): Promise<{ ok: boolean; error?: string }> {
    try {
        const res = await fetch(`${CAL_API_BASE}/event-types/${eventTypeId}`, {
            method: "DELETE",
            headers: calHeaders(apiKey),
        });

        if (!res.ok) {
            const text = await res.text();
            console.error("Cal.com delete event type error:", res.status, text);
            return { ok: false, error: `Cal.com error ${res.status}` };
        }

        return { ok: true };
    } catch (err) {
        console.error("Cal.com delete event type fetch error:", err);
        return { ok: false, error: String(err) };
    }
}

// ── Bookings ─────────────────────────────────────────────────────

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
