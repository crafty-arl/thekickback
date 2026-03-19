"use server";

import { createClient } from "@supabase/supabase-js";

export interface VenueData {
    id: string;
    name: string;
    slug: string;
    category: string;
    neighborhood: string;
    vibe: string;
    occupancy: number;
    capacity: number;
    description: string;
    tags: string[];
    hours: string;
    memberOnly: boolean;
    textNumber: string;
    latitude: number;
    longitude: number;
    themeColor: string;
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
      hours,
      venues (
        id,
        name,
        type,
        address,
        neighborhood,
        lat,
        lng,
        occupancy,
        max_occupancy,
        vibe,
        phone,
        twilio_number
      )
    `)
        .eq("published", true)
        .eq("review_status", "approved");

    if (error) {
        console.error("[fetchApprovedVenues] Supabase error:", error.message);
        return [];
    }

    if (!pages || pages.length === 0) {
        return [];
    }

    return pages
        .filter((p: Record<string, unknown>) => {
            const v = p.venues as Record<string, unknown> | null;
            return v && typeof v.lat === "number" && typeof v.lng === "number";
        })
        .map((p: Record<string, unknown>) => {
            const v = p.venues as Record<string, unknown>;
            const hours = p.hours as Array<{ day: string; open: string; close: string }> | null;
            const hoursStr = hours && hours.length > 0
                ? hours.map((h) => `${h.day} ${h.open}${h.close ? ` – ${h.close}` : ""}`).join(", ")
                : "Hours vary";

            return {
                id: p.slug as string,
                name: v.name as string,
                slug: p.slug as string,
                category: (v.type as string) || "venue",
                neighborhood: (v.neighborhood as string) || "",
                vibe: (v.vibe as string) || "quiet",
                occupancy: (v.occupancy as number) || 0,
                capacity: (v.max_occupancy as number) || 100,
                description: (p.description as string) || (p.tagline as string) || "",
                tags: [],
                hours: hoursStr,
                memberOnly: false,
                textNumber: (v.twilio_number as string) || (v.phone as string) || "",
                latitude: v.lat as number,
                longitude: v.lng as number,
                themeColor: (p.theme_color as string) || "#F97316",
            };
        });
}
