"use server";

import { createClient } from "@supabase/supabase-js";

export interface VenueData {
    id: string;
    name: string;
    slug: string;
    category: string;
    neighborhood: string;
    vibe: string;
    description: string;
    tags: string[];
    hours: string;
    memberOnly: boolean;
    textNumber: string;
    latitude: number;
    longitude: number;
    themeColor: string;
    isEventPin?: boolean;
    parentVenueId?: string;
    eventName?: string;
    eventDate?: string;
    locationMode?: "fixed" | "mobile" | "virtual";
}

/**
 * Fetch all approved & published venues from Supabase.
 * Uses the service client to bypass RLS for server-side data fetching.
 */
export async function fetchApprovedVenues(): Promise<VenueData[]> {
    const supabase = createClient(
        process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_KEY!,
    );

    const { data: pages, error } = await supabase
        .from("venue_pages")
        .select(`
      slug,
      tagline,
      description,
      theme_color,
      hero_image,
      logo,
      hours,
      venues!inner (
        id,
        name,
        type,
        address,
        neighborhood,
        latitude,
        longitude,
        lat,
        lng,
        vibe,
        phone,
        twilio_number,
        mode
      )
    `)
        .eq("published", true)
        .eq("review_status", "approved")
        .eq("venues.mode", "live");

    if (error) {
        console.error("[fetchApprovedVenues] Supabase error:", error.message);
        return [];
    }

    if (!pages || pages.length === 0) {
        return [];
    }

    // Build a set of venue IDs with coordinates (for dedup with event pins later)
    const venueCoordSet = new Map<string, { lat: number; lng: number }>();

    // Build venue page map for ALL venues (including those without coords, for event pin inheritance)
    const allVenuePageMap = new Map<string, Record<string, unknown>>();
    for (const p of (pages || []) as Record<string, unknown>[]) {
        const raw = p.venues;
        const v = (Array.isArray(raw) ? raw[0] : raw) as Record<string, unknown> | null;
        if (v) allVenuePageMap.set(v.id as string, p);
    }

    // Split into places with coordinates (map pins) and without (virtual list)
    const withCoords: Record<string, unknown>[] = [];
    const withoutCoords: Record<string, unknown>[] = [];
    for (const p of pages as Record<string, unknown>[]) {
        const v = p.venues as Record<string, unknown> | null;
        if (!v) continue;
        const hasCoords = (typeof v.latitude === "number" && typeof v.longitude === "number")
            || (typeof v.lat === "number" && typeof v.lng === "number");
        if (hasCoords) withCoords.push(p);
        else withoutCoords.push(p);
    }

    const venueResults = withCoords
        .map((p: Record<string, unknown>) => {
            const v = p.venues as Record<string, unknown>;
            const hours = p.hours as Array<{ day: string; open: string; close: string }> | null;
            const hoursStr = hours && hours.length > 0
                ? hours.map((h) => `${h.day} ${h.open}${h.close ? ` – ${h.close}` : ""}`).join(", ")
                : "Hours vary";

            const lat = (v.latitude as number) || (v.lat as number);
            const lng = (v.longitude as number) || (v.lng as number);
            const venueId = v.id as string;

            venueCoordSet.set(venueId, { lat, lng });

            return {
                id: venueId,
                name: v.name as string,
                slug: p.slug as string,
                category: (v.type as string) || "venue",
                neighborhood: (v.neighborhood as string) || "",
                vibe: (v.vibe as string) || "quiet",
                description: (p.description as string) || (p.tagline as string) || "",
                tagline: (p.tagline as string) || "",
                address: (v.address as string) || "",
                tags: [],
                hours: hoursStr,
                memberOnly: false,
                textNumber: (v.twilio_number as string) || (v.phone as string) || "",
                latitude: lat,
                longitude: lng,
                themeColor: (p.theme_color as string) || "#F97316",
                heroImage: (p.hero_image as string) || null,
                logo: (p.logo as string) || null,
                locationMode: "fixed" as const,
            };
        });

    // --- Fetch event offerings with their own locations ---
    const { data: eventOfferings, error: eventError } = await supabase
        .from("venue_offerings")
        .select(`
            id, name, description, location_name, location_address,
            location_lat, location_lng, venue_id, starts_at, ends_at
        `)
        .eq("type", "event")
        .eq("active", true)
        .not("location_lat", "is", null)
        .not("location_lng", "is", null);

    if (eventError) {
        console.error("[fetchApprovedVenues] event offerings error:", eventError.message);
    }

    const eventPins: VenueData[] = [];

    if (eventOfferings && eventOfferings.length > 0) {
        for (const ev of eventOfferings) {
            const venueId = ev.venue_id as string;
            const evLat = ev.location_lat as number;
            const evLng = ev.location_lng as number;

            // Skip if event is at the same location as the parent venue pin (within ~50m)
            const parentCoords = venueCoordSet.get(venueId);
            if (parentCoords) {
                const dlat = Math.abs(parentCoords.lat - evLat);
                const dlng = Math.abs(parentCoords.lng - evLng);
                if (dlat < 0.0005 && dlng < 0.0005) continue;
            }

            // Use parent venue page data if available (works even for venues without coords)
            const parentPage = allVenuePageMap.get(venueId);
            const parentVenue = parentPage
                ? (parentPage.venues as Record<string, unknown>)
                : null;

            const startsAt = ev.starts_at as string | null;

            eventPins.push({
                id: `event-${ev.id}`,
                name: parentVenue ? (parentVenue.name as string) : (ev.name as string),
                slug: parentPage ? (parentPage.slug as string) : "",
                category: "event",
                neighborhood: (ev.location_name as string) || "",
                vibe: parentVenue ? ((parentVenue.vibe as string) || "moderate") : "moderate",
                description: (ev.description as string) || "",
                tags: [],
                hours: startsAt ? new Date(startsAt).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : "",
                memberOnly: false,
                textNumber: parentVenue
                    ? ((parentVenue.twilio_number as string) || (parentVenue.phone as string) || "")
                    : "",
                latitude: evLat,
                longitude: evLng,
                themeColor: parentPage
                    ? ((parentPage.theme_color as string) || "#F97316")
                    : "#F97316",
                heroImage: parentPage ? ((parentPage.hero_image as string) || null) : null,
                logo: parentPage ? ((parentPage.logo as string) || null) : null,
                isEventPin: true,
                parentVenueId: venueId,
                eventName: ev.name as string,
                eventDate: startsAt || undefined,
                locationMode: "fixed",
            } as VenueData);
        }
    }

    // Build virtual places (no coordinates — won't show on map, only in explore list)
    const virtualResults = withoutCoords.map((p) => {
        const v = p.venues as Record<string, unknown>;
        const hours = p.hours as Array<{ day: string; open: string; close: string }> | null;
        const hoursStr = hours && hours.length > 0
            ? hours.map((h) => `${h.day} ${h.open}${h.close ? ` – ${h.close}` : ""}`).join(", ")
            : "";
        return {
            id: v.id as string,
            name: v.name as string,
            slug: p.slug as string,
            category: (v.type as string) || "community",
            neighborhood: (v.neighborhood as string) || "",
            vibe: (v.vibe as string) || "moderate",
            description: (p.description as string) || (p.tagline as string) || "",
            tagline: (p.tagline as string) || "",
            address: (v.address as string) || "",
            tags: [],
            hours: hoursStr,
            memberOnly: false,
            textNumber: "",
            latitude: 0,
            longitude: 0,
            themeColor: (p.theme_color as string) || "#F97316",
            heroImage: (p.hero_image as string) || null,
            logo: (p.logo as string) || null,
            locationMode: "virtual" as const,
            claimed: true,
        } as VenueData;
    });

    return [...venueResults, ...eventPins, ...virtualResults];
}
