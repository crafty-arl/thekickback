import { unstable_cache } from "next/cache";
import { type Venue } from "./venues";

const FSQ_API_BASE = "https://places-api.foursquare.com";

// Rich fields: name, location, categories, coordinates, rating, hours, photos, tips, price
const FSQ_FIELDS = [
    "fsq_place_id", "name", "location", "categories", "geocodes",
    "rating", "stats", "price", "hours", "photos", "tips", "description", "tel", "website",
].join(",");

// Broader search to capture more Milwaukee places
const SEARCH_QUERIES = ["bar", "cafe", "restaurant", "lounge", "nightclub", "barbershop", "salon", "gym", "coworking", "brewery", "bakery"];

// Milwaukee WI fallback center
const DEFAULT_CENTER = { lat: 43.0389, lng: -87.9065 };
const DEFAULT_RADIUS = 5000; // 5 km

const GOOGLE_PLACES_KEY = process.env.GOOGLE_PLACES_API_KEY || "";

interface FsqPlace {
    fsq_place_id: string;
    name: string;
    location?: {
        address?: string;
        neighborhood?: string[];
        formatted_address?: string;
    };
    categories?: { name: string; short_name?: string }[];
    geocodes?: {
        main?: { latitude: number; longitude: number };
    };
    rating?: number;
    stats?: { total_photos?: number; total_ratings?: number; total_tips?: number };
    price?: number;
    hours?: { display?: string; open_now?: boolean };
    photos?: { prefix?: string; suffix?: string; width?: number; height?: number }[];
    tips?: { text?: string; created_at?: string }[];
    description?: string;
    tel?: string;
    website?: string;
}

async function fetchFsqPlaces(
    query: string,
    token: string,
    center: { lat: number; lng: number },
    radius: number = DEFAULT_RADIUS
): Promise<FsqPlace[]> {
    const params = new URLSearchParams({
        query,
        ll: `${center.lat},${center.lng}`,
        radius: String(radius),
        limit: "20",
        fields: FSQ_FIELDS,
        sort: "POPULARITY",
    });

    try {
        const res = await fetch(`${FSQ_API_BASE}/places/search?${params}`, {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
                "X-Places-Api-Version": "2025-02-05",
            },
        });
        if (!res.ok) {
            console.error(`[fetchDiscovery] FSQ ${query}: HTTP ${res.status}`);
            return [];
        }
        const data = await res.json();
        return (data.results || []) as FsqPlace[];
    } catch (err) {
        console.error(`[fetchDiscovery] FSQ ${query}:`, err);
        return [];
    }
}

// ─── Google Places: get rating + review count for a venue by name + location ──

interface GooglePlaceInfo {
    rating: number | null;
    reviewCount: number | null;
    priceLevel: number | null;
}

async function fetchGoogleRating(name: string, lat: number, lng: number): Promise<GooglePlaceInfo> {
    if (!GOOGLE_PLACES_KEY) return { rating: null, reviewCount: null, priceLevel: null };

    try {
        const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Goog-Api-Key": GOOGLE_PLACES_KEY,
                "X-Goog-FieldMask": "places.rating,places.userRatingCount,places.priceLevel",
            },
            body: JSON.stringify({
                textQuery: name,
                locationBias: {
                    circle: {
                        center: { latitude: lat, longitude: lng },
                        radius: 200.0,
                    },
                },
                maxResultCount: 1,
            }),
        });

        if (!res.ok) return { rating: null, reviewCount: null, priceLevel: null };
        const data = await res.json();
        const place = data.places?.[0];
        if (!place) return { rating: null, reviewCount: null, priceLevel: null };

        const priceLevelMap: Record<string, number> = {
            PRICE_LEVEL_FREE: 0, PRICE_LEVEL_INEXPENSIVE: 1,
            PRICE_LEVEL_MODERATE: 2, PRICE_LEVEL_EXPENSIVE: 3, PRICE_LEVEL_VERY_EXPENSIVE: 4,
        };

        return {
            rating: place.rating || null,
            reviewCount: place.userRatingCount || null,
            priceLevel: priceLevelMap[place.priceLevel] ?? null,
        };
    } catch {
        return { rating: null, reviewCount: null, priceLevel: null };
    }
}

function mapCategory(categories?: { name: string; short_name?: string }[]): string {
    if (!categories || categories.length === 0) return "venue";
    const name = (categories[0].short_name || categories[0].name).toLowerCase();
    if (name.includes("bar") || name.includes("pub") || name.includes("brew")) return "bar";
    if (name.includes("caf") || name.includes("coffee") || name.includes("bake")) return "cafe";
    if (name.includes("restaurant") || name.includes("diner")) return "restaurant";
    if (name.includes("lounge") || name.includes("hookah")) return "lounge";
    if (name.includes("club") || name.includes("night")) return "club";
    if (name.includes("rooftop")) return "rooftop";
    if (name.includes("cowork")) return "coworking";
    if (name.includes("barber")) return "barbershop";
    if (name.includes("salon") || name.includes("nail") || name.includes("hair") || name.includes("beauty")) return "salon";
    if (name.includes("gym") || name.includes("fitness")) return "gym";
    return "venue";
}

function mapVibeFromRating(rating?: number): "quiet" | "moderate" | "busy" | "lit" {
    if (!rating) return "moderate";
    if (rating >= 8.5) return "lit";
    if (rating >= 7) return "busy";
    if (rating >= 5) return "moderate";
    return "quiet";
}

export async function fetchDiscoveryVenuesForLocation(
    lat: number,
    lng: number,
    radiusMeters: number = DEFAULT_RADIUS
): Promise<Venue[]> {
    const token = process.env.FOURSQUARE_SERVICE_TOKEN;
    if (!token) {
        console.warn("[fetchDiscovery] No FOURSQUARE_SERVICE_TOKEN — skipping discovery venues");
        return [];
    }

    const center = { lat, lng };

    // Fetch all categories in parallel
    const results = await Promise.all(
        SEARCH_QUERIES.map((q) => fetchFsqPlaces(q, token, center, radiusMeters))
    );

    // Flatten and deduplicate by fsq_place_id
    const seen = new Set<string>();
    const fsqPlaces: FsqPlace[] = [];

    for (const places of results) {
        for (const place of places) {
            if (seen.has(place.fsq_place_id)) continue;
            seen.add(place.fsq_place_id);
            if (!place.geocodes?.main) continue;
            fsqPlaces.push(place);
        }
    }

    // Fetch Google ratings in parallel (batch of 10 at a time to avoid rate limits)
    const googleRatings = new Map<string, GooglePlaceInfo>();
    if (GOOGLE_PLACES_KEY) {
        const batches: FsqPlace[][] = [];
        for (let i = 0; i < fsqPlaces.length; i += 10) {
            batches.push(fsqPlaces.slice(i, i + 10));
        }
        for (const batch of batches) {
            const ratings = await Promise.all(
                batch.map((p) => fetchGoogleRating(p.name, p.geocodes!.main!.latitude, p.geocodes!.main!.longitude))
            );
            batch.forEach((p, i) => googleRatings.set(p.fsq_place_id, ratings[i]));
        }
    }

    // Build venue objects
    const venues: Venue[] = fsqPlaces.map((place) => {
        const geo = place.geocodes!.main!;
        const google = googleRatings.get(place.fsq_place_id);
        const firstPhoto = place.photos?.[0];
        const photoUrl = firstPhoto ? `${firstPhoto.prefix}300x200${firstPhoto.suffix}` : null;
        const firstTip = place.tips?.[0]?.text || null;

        return {
            id: `fsq-${place.fsq_place_id}`,
            name: place.name,
            category: mapCategory(place.categories),
            neighborhood: place.location?.neighborhood?.[0] || "",
            vibe: mapVibeFromRating(place.rating),
            description: firstTip || place.description || place.location?.formatted_address || "",
            address: place.location?.formatted_address || "",
            tags: (place.categories || []).map((c) => c.name),
            hours: place.hours?.display || "",
            memberOnly: false,
            textNumber: place.tel || "",
            latitude: geo.latitude,
            longitude: geo.longitude,
            claimed: false,
            rating: google?.rating || (place.rating ? place.rating / 2 : null), // FSQ is 0-10, normalize to 0-5
            reviewCount: google?.reviewCount || place.stats?.total_ratings || null,
            priceLevel: google?.priceLevel ?? place.price ?? null,
            photoUrl,
            heroImage: photoUrl,
        };
    });

    return venues;
}

/**
 * Fetches discovery venues from Foursquare for the default Milwaukee center,
 * cached for 1 hour. Used as the server-side fallback.
 */
export const fetchDiscoveryVenues = unstable_cache(
    () => fetchDiscoveryVenuesForLocation(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng),
    ["discovery-venues-milwaukee"],
    { revalidate: 3600 }
);
