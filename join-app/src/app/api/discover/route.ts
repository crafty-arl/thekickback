import { NextRequest, NextResponse } from "next/server";
import { fetchDiscoveryVenuesForLocation } from "@/lib/fetch-discovery";

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

    // Clamp to reasonable bounds
    const radius = parseInt(searchParams.get("radius") || "5000");
    const clampedLat = Math.max(-90, Math.min(90, lat));
    const clampedLng = Math.max(-180, Math.min(180, lng));
    const clampedRadius = Math.max(500, Math.min(50000, radius)); // 500m - 50km

    try {
        const venues = await fetchDiscoveryVenuesForLocation(clampedLat, clampedLng, clampedRadius);
        return NextResponse.json(venues, {
            headers: {
                // Cache for 1 hour at CDN + browser level
                "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=1800",
            },
        });
    } catch (err) {
        console.error("[/api/discover] Error:", err);
        return NextResponse.json([], { status: 500 });
    }
}
