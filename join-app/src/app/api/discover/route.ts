import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchDiscoveryVenuesForLocation } from "@/lib/fetch-discovery";

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
);

export async function GET(request: NextRequest) {
    const { searchParams } = request.nextUrl;
    const lat = parseFloat(searchParams.get("lat") || "");
    const lng = parseFloat(searchParams.get("lng") || "");

    if (isNaN(lat) || isNaN(lng)) {
        return NextResponse.json(
            { error: "lat and lng query params are required" },
            { status: 400 }
        );
    }

    const radius = parseInt(searchParams.get("radius") || "5000");
    const clampedLat = Math.max(-90, Math.min(90, lat));
    const clampedLng = Math.max(-180, Math.min(180, lng));
    const clampedRadius = Math.max(500, Math.min(50000, radius));

    try {
        const venues = await fetchDiscoveryVenuesForLocation(clampedLat, clampedLng, clampedRadius);

        // Persist discovered venues to DB (upsert by fsq_place_id, fire-and-forget)
        persistDiscoveredVenues(venues).catch((err) =>
            console.error("[discover] persist error:", err)
        );

        return NextResponse.json(venues, {
            headers: {
                "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=1800",
            },
        });
    } catch (err) {
        console.error("[/api/discover] Error:", err);
        return NextResponse.json([], { status: 500 });
    }
}

// ─── Persist discovered venues to Supabase ──────────────────────────
// Creates unclaimed venue + venue_page records so they persist across visits
// and show up in server-side fetches (fetchApprovedVenues won't include them
// since they're not approved, but the concierge and ghost agents can query them)

async function persistDiscoveredVenues(venues: { id: string; name: string; category: string; neighborhood: string; address?: string; latitude: number; longitude: number; rating?: number | null; reviewCount?: number | null; priceLevel?: number | null; description?: string }[]) {
    if (venues.length === 0) return;

    for (const v of venues) {
        if (!v.id.startsWith("fsq-")) continue;
        const fsqPlaceId = v.id.replace("fsq-", "");

        // Check if already persisted by fsq_place_id
        const { data: existing } = await supabase
            .from("venues")
            .select("id")
            .eq("fsq_place_id", fsqPlaceId)
            .maybeSingle();

        if (existing) continue;

        // Create venue record (unclaimed state — won't show in claimed queries)
        const { data: venue, error: venueErr } = await supabase.from("venues").insert({
            name: v.name,
            type: v.category || "venue",
            address: v.address || null,
            neighborhood: v.neighborhood || null,
            lat: v.latitude,
            lng: v.longitude,
            state: "unclaimed",
            vibe: "moderate",
            mode: "live",
            rules: [],
            fsq_place_id: fsqPlaceId,
        }).select("id").single();

        if (venueErr || !venue) continue;

        // Create minimal venue page (not published, review_status=unclaimed)
        const slug = v.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Math.random().toString(36).slice(2, 6);
        await supabase.from("venue_pages").insert({
            venue_id: venue.id,
            slug,
            description: v.description || null,
            theme_color: "#F97316",
            published: false,
            review_status: "unclaimed",
        }).catch(() => {});
    }
}
