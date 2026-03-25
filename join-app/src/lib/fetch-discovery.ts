import { unstable_cache } from "next/cache";
import { type Venue } from "./venues";

const FSQ_API_BASE = "https://places-api.foursquare.com";

const FSQ_FIELDS = [
    "fsq_place_id", "name", "location", "categories", "geocodes",
].join(",");

// Foursquare category IDs for venue types we care about
const SEARCH_QUERIES = ["bar", "cafe", "restaurant", "lounge", "nightclub"];

// Milwaukee WI fallback center
const DEFAULT_CENTER = { lat: 43.0389, lng: -87.9065 };
const DEFAULT_RADIUS = 5000; // 5 km

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
        limit: "15",
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

function mapCategory(categories?: { name: string; short_name?: string }[]): string {
    if (!categories || categories.length === 0) return "venue";
    const name = (categories[0].short_name || categories[0].name).toLowerCase();
    if (name.includes("bar") || name.includes("pub")) return "bar";
    if (name.includes("caf") || name.includes("coffee")) return "cafe";
    if (name.includes("restaurant") || name.includes("diner")) return "restaurant";
    if (name.includes("lounge") || name.includes("hookah")) return "lounge";
    if (name.includes("club") || name.includes("night")) return "club";
    if (name.includes("rooftop")) return "rooftop";
    if (name.includes("cowork")) return "coworking";
    return "venue";
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
    const venues: Venue[] = [];

    for (const places of results) {
        for (const place of places) {
            if (seen.has(place.fsq_place_id)) continue;
            seen.add(place.fsq_place_id);

            const geo = place.geocodes?.main;
            if (!geo) continue;

            venues.push({
                id: `fsq-${place.fsq_place_id}`,
                name: place.name,
                category: mapCategory(place.categories),
                neighborhood: place.location?.neighborhood?.[0] || "",
                vibe: "moderate",
                description: place.location?.formatted_address || "",
                tags: (place.categories || []).map((c) => c.name),
                hours: "",
                memberOnly: false,
                textNumber: "",
                latitude: geo.latitude,
                longitude: geo.longitude,
                claimed: false,
            });
        }
    }

    return venues;
}

/**
 * Fetches discovery venues from Foursquare for the default Milwaukee center,
 * cached for 1 hour. Used as the server-side fallback.
 */
export const fetchDiscoveryVenues = unstable_cache(
    () => fetchDiscoveryVenuesForLocation(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng),
    ["discovery-venues-default"],
    { revalidate: 3600 } // 1 hour
);
