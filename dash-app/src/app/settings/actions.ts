"use server";

import { createClient } from "@supabase/supabase-js";
import { createClient as createAuthClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const CF_ACCOUNT_ID = "6c235bb622d4bca66876392df398234b";
const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN || "";

const service = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
);

// ─── Auth helper ─────────────────────────────────────────────────

async function getAuthVenue(): Promise<{ userId: string; venueId: string } | null> {
    const supabase = await createAuthClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data } = await service
        .from("venue_owners")
        .select("venue_id")
        .eq("user_id", user.id)
        .limit(1)
        .single();

    if (!data) return null;
    return { userId: user.id, venueId: data.venue_id };
}

// ─── Venue actions ───────────────────────────────────────────────

export async function updateVenue(venueId: string, data: {
    name?: string;
    type?: string;
    address?: string;
    neighborhood?: string;
    max_occupancy?: number;
    vibe?: string;
    rules?: string[];
    lat?: number | null;
    lng?: number | null;
}) {
    const auth = await getAuthVenue();
    if (!auth) return { error: "Not authenticated" };
    if (auth.venueId !== venueId) return { error: "Not authorized" };

    // Geocode if address changed
    if (data.address) {
        try {
            const geoRes = await fetch(
                `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(data.address)}&format=json&limit=1`,
                { headers: { "User-Agent": "theKickBack/1.0" } }
            );
            if (geoRes.ok) {
                const geo = await geoRes.json() as { lat: string; lon: string; display_name: string }[];
                if (geo.length > 0) {
                    data.lat = parseFloat(geo[0].lat);
                    data.lng = parseFloat(geo[0].lon);
                    const parts = geo[0].display_name.split(",");
                    data.neighborhood = parts.length > 1 ? parts[1].trim() : data.neighborhood;
                }
            }
        } catch { /* best effort */ }
    }

    const { error } = await service.from("venues").update(data).eq("id", venueId);
    if (error) return { error: error.message };

    revalidatePath("/");
    revalidatePath("/settings");
    return { ok: true };
}

export async function updateVenuePage(venueId: string, data: {
    tagline?: string;
    description?: string;
    theme_color?: string;
    hours?: { day: string; open: string; close: string }[];
    menu_sections?: { name: string; items: string[] }[];
    slug?: string;
}) {
    const auth = await getAuthVenue();
    if (!auth) return { error: "Not authenticated" };
    if (auth.venueId !== venueId) return { error: "Not authorized" };

    const { error } = await service.from("venue_pages").update(data).eq("venue_id", venueId);
    if (error) return { error: error.message };

    revalidatePath("/");
    revalidatePath("/settings");
    return { ok: true };
}

// ─── AI Knowledge actions ────────────────────────────────────────

async function generateEmbedding(text: string): Promise<number[] | null> {
    try {
        const res = await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run/@cf/baai/bge-base-en-v1.5`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${CF_API_TOKEN}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ text: [text] }),
            }
        );
        if (!res.ok) { console.error("Embedding error:", await res.text()); return null; }
        const data = await res.json() as { result?: { data?: number[][] } };
        return data.result?.data?.[0] || null;
    } catch (err) {
        console.error("Embedding fetch error:", err);
        return null;
    }
}

export async function addKnowledge(content: string, category: string) {
    const auth = await getAuthVenue();
    if (!auth) return { error: "Not authenticated" };
    if (!content.trim()) return { error: "Content is empty" };

    const embedding = await generateEmbedding(content);

    const { error } = await service.from("venue_knowledge").insert({
        venue_id: auth.venueId,
        content: content.trim(),
        category,
        embedding: embedding ? `[${embedding.join(",")}]` : null,
    });

    if (error) return { error: error.message };
    revalidatePath("/settings");
    return { ok: true };
}

export async function deleteKnowledge(id: string) {
    const auth = await getAuthVenue();
    if (!auth) return { error: "Not authenticated" };

    const { error } = await service
        .from("venue_knowledge")
        .delete()
        .eq("id", id)
        .eq("venue_id", auth.venueId);

    if (error) return { error: error.message };
    revalidatePath("/settings");
    return { ok: true };
}

// ─── Offering actions ────────────────────────────────────────────

export async function addOffering(data: {
    name: string;
    type: string;
    description?: string;
    price_cents: number;
    recurring?: boolean;
    interval?: string;
    perks?: string[];
}) {
    const auth = await getAuthVenue();
    if (!auth) return { error: "Not authenticated" };
    if (!data.name.trim()) return { error: "Name is required" };

    const { error } = await service.from("venue_offerings").insert({
        venue_id: auth.venueId,
        name: data.name.trim(),
        type: data.type,
        description: data.description?.trim() || null,
        price_cents: data.price_cents,
        recurring: data.recurring || false,
        interval: data.recurring ? (data.interval || "month") : null,
        perks: data.perks || [],
    });

    if (error) return { error: error.message };
    revalidatePath("/settings");
    return { ok: true };
}

export async function updateOffering(id: string, data: {
    name?: string;
    description?: string;
    price_cents?: number;
    perks?: string[];
    active?: boolean;
}) {
    const auth = await getAuthVenue();
    if (!auth) return { error: "Not authenticated" };

    const { error } = await service
        .from("venue_offerings")
        .update(data)
        .eq("id", id)
        .eq("venue_id", auth.venueId);

    if (error) return { error: error.message };
    revalidatePath("/settings");
    return { ok: true };
}

export async function deleteOffering(id: string) {
    const auth = await getAuthVenue();
    if (!auth) return { error: "Not authenticated" };

    const { error } = await service
        .from("venue_offerings")
        .delete()
        .eq("id", id)
        .eq("venue_id", auth.venueId);

    if (error) return { error: error.message };
    revalidatePath("/settings");
    return { ok: true };
}

export async function toggleOffering(id: string, active: boolean) {
    const auth = await getAuthVenue();
    if (!auth) return { error: "Not authenticated" };

    const { error } = await service
        .from("venue_offerings")
        .update({ active })
        .eq("id", id)
        .eq("venue_id", auth.venueId);

    if (error) return { error: error.message };
    revalidatePath("/settings");
    return { ok: true };
}
