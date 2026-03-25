import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
);

const GOOGLE_KEY = process.env.GOOGLE_PLACES_API_KEY || "";

interface GooglePlace {
  id: string;
  displayName: { text: string };
  formattedAddress: string;
  location?: { latitude: number; longitude: number };
  rating?: number;
  userRatingCount?: number;
  types?: string[];
}

// GET /api/places-search?q=anodyne+coffee
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") || "";
  if (q.length < 2) return NextResponse.json({ results: [] });

  const results: {
    name: string;
    address: string;
    lat: number | null;
    lng: number | null;
    rating: number | null;
    reviewCount: number | null;
    googlePlaceId: string | null;
    unclaimedVenueId: string | null;
  }[] = [];

  // 1. Search Google Places
  if (GOOGLE_KEY) {
    try {
      const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": GOOGLE_KEY,
          "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount",
        },
        body: JSON.stringify({
          textQuery: q,
          maxResultCount: 5,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        for (const place of (data.places || []) as GooglePlace[]) {
          results.push({
            name: place.displayName?.text || "",
            address: place.formattedAddress || "",
            lat: place.location?.latitude || null,
            lng: place.location?.longitude || null,
            rating: place.rating || null,
            reviewCount: place.userRatingCount || null,
            googlePlaceId: place.id || null,
            unclaimedVenueId: null,
          });
        }
      }
    } catch (err) {
      console.error("[places-search] Google error:", err);
    }
  }

  // 2. Check each result against unclaimed venues in DB
  for (const r of results) {
    if (!r.name) continue;

    // Match by name (case-insensitive) + proximity if we have coords
    const { data: match } = await supabase
      .from("venues")
      .select("id, state")
      .ilike("name", r.name)
      .eq("state", "unclaimed")
      .limit(1)
      .maybeSingle();

    if (match) {
      r.unclaimedVenueId = match.id;
    }
  }

  return NextResponse.json({ results });
}
