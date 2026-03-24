"use server";

import { createClient } from "@supabase/supabase-js";
import { createClient as createAuthClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { createCalEventType, deleteCalEventType } from "@/lib/cal";

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

// ─── Cal.com key helper ──────────────────────────────────────────

async function getVenueCalKey(venueId: string): Promise<string | null> {
    const { data } = await service
        .from("venues")
        .select("cal_api_key")
        .eq("id", venueId)
        .single();
    return data?.cal_api_key || process.env.CAL_API_KEY || null;
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
    check_in_radius_meters?: number;
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

export async function uploadOfferingImage(offeringId: string, formData: FormData) {
    const auth = await getAuthVenue();
    if (!auth) return { error: "Not authenticated" };

    const file = formData.get("file") as File;
    if (!file) return { error: "No file" };

    const ext = file.name.split(".").pop() || "jpg";
    const fileName = `${auth.venueId}/offerings/${offeringId}-${Date.now()}.${ext}`;

    const { data: upload, error: uploadErr } = await service
        .storage
        .from("venue-assets")
        .upload(fileName, file, { upsert: true, contentType: file.type });

    if (uploadErr) return { error: uploadErr.message };

    const { data: { publicUrl } } = service.storage.from("venue-assets").getPublicUrl(upload.path);

    const { error } = await service
        .from("venue_offerings")
        .update({ image_url: publicUrl })
        .eq("id", offeringId)
        .eq("venue_id", auth.venueId);

    if (error) return { error: error.message };
    revalidatePath("/settings");
    return { url: publicUrl };
}

export async function addOffering(data: {
    name: string;
    type: string;
    description?: string;
    price_cents: number;
    recurring?: boolean;
    interval?: string;
    perks?: string[];
    duration_minutes?: number;
    capacity?: number;
    add_ons?: { name: string; price_cents: number }[];
    starts_at?: string;
    ends_at?: string;
}) {
    const auth = await getAuthVenue();
    if (!auth) return { error: "Not authenticated" };
    if (!data.name.trim()) return { error: "Name is required" };

    const { data: insertedRows, error } = await service.from("venue_offerings").insert({
        venue_id: auth.venueId,
        name: data.name.trim(),
        type: data.type,
        description: data.description?.trim() || null,
        price_cents: data.price_cents,
        recurring: data.recurring || false,
        interval: data.recurring ? (data.interval || "month") : null,
        perks: data.perks || [],
        duration_minutes: data.duration_minutes || null,
        capacity: data.capacity || null,
        add_ons: data.add_ons || [],
        starts_at: data.starts_at || null,
        ends_at: data.ends_at || null,
    }).select("id");

    if (error) return { error: error.message };

    // Sync to Cal.com — create matching event type
    const calKey = await getVenueCalKey(auth.venueId);
    if (calKey && insertedRows?.[0]) {
        const venue = await service.from("venues").select("address").eq("id", auth.venueId).single();
        const calResult = await createCalEventType(calKey, {
            title: data.name.trim(),
            durationMinutes: data.duration_minutes || 30,
            description: data.description?.trim(),
            address: venue.data?.address || undefined,
        });
        if ("id" in calResult) {
            await service.from("venue_offerings")
                .update({ cal_event_type_id: calResult.id })
                .eq("id", insertedRows[0].id);
        }
    }

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

    // Get cal_event_type_id before deleting
    const { data: offering } = await service
        .from("venue_offerings")
        .select("cal_event_type_id")
        .eq("id", id)
        .eq("venue_id", auth.venueId)
        .single();

    const { error } = await service
        .from("venue_offerings")
        .delete()
        .eq("id", id)
        .eq("venue_id", auth.venueId);

    if (error) return { error: error.message };

    // Delete from Cal.com too
    if (offering?.cal_event_type_id) {
        const calKey = await getVenueCalKey(auth.venueId);
        if (calKey) {
            await deleteCalEventType(calKey, offering.cal_event_type_id);
        }
    }

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

// ─── XP Roadmap actions ─────────────────────────────────────────

export async function addXpAction(data: { action: string; label: string; points: number; description?: string; max_per_day?: number }) {
    const auth = await getAuthVenue();
    if (!auth) return { error: "Not authenticated" };

    const { error } = await service.from("venue_xp_actions").insert({
        venue_id: auth.venueId,
        action: data.action,
        label: data.label,
        points: data.points,
        description: data.description || null,
        max_per_day: data.max_per_day || null,
    });

    if (error) return { error: error.message };
    revalidatePath("/settings");
    return { ok: true };
}

export async function deleteXpAction(id: string) {
    const auth = await getAuthVenue();
    if (!auth) return { error: "Not authenticated" };

    const { error } = await service
        .from("venue_xp_actions")
        .delete()
        .eq("id", id)
        .eq("venue_id", auth.venueId);

    if (error) return { error: error.message };
    revalidatePath("/settings");
    return { ok: true };
}

export async function toggleXpAction(id: string, active: boolean) {
    const auth = await getAuthVenue();
    if (!auth) return { error: "Not authenticated" };

    const { error } = await service
        .from("venue_xp_actions")
        .update({ active })
        .eq("id", id)
        .eq("venue_id", auth.venueId);

    if (error) return { error: error.message };
    revalidatePath("/settings");
    return { ok: true };
}

export async function addXpMilestone(data: { name: string; threshold: number; color: string; reward?: string; perks?: string[] }) {
    const auth = await getAuthVenue();
    if (!auth) return { error: "Not authenticated" };

    const { error } = await service.from("venue_xp_milestones").insert({
        venue_id: auth.venueId,
        name: data.name,
        threshold: data.threshold,
        color: data.color,
        reward: data.reward || null,
        perks: data.perks || [],
    });

    if (error) return { error: error.message };
    revalidatePath("/settings");
    return { ok: true };
}

export async function applyXpTemplate(
    actions: { action: string; label: string; points: number; description?: string; max_per_day?: number }[],
    milestones: { name: string; threshold: number; color: string; reward?: string; perks?: string[] }[]
) {
    const auth = await getAuthVenue();
    if (!auth) return { error: "Not authenticated" };

    // Clear existing actions and milestones
    await service.from("venue_xp_actions").delete().eq("venue_id", auth.venueId);
    await service.from("venue_xp_milestones").delete().eq("venue_id", auth.venueId);

    // Insert new actions
    if (actions.length > 0) {
        const actionRows = actions.map((a, i) => ({
            venue_id: auth.venueId,
            action: a.action,
            label: a.label,
            points: a.points,
            description: a.description || null,
            max_per_day: a.max_per_day || null,
            sort_order: i,
        }));
        const { error: aErr } = await service.from("venue_xp_actions").insert(actionRows);
        if (aErr) return { error: aErr.message };
    }

    // Insert new milestones
    if (milestones.length > 0) {
        const milestoneRows = milestones.map((m, i) => ({
            venue_id: auth.venueId,
            name: m.name,
            threshold: m.threshold,
            color: m.color,
            reward: m.reward || null,
            perks: m.perks || [],
            sort_order: i,
        }));
        const { error: mErr } = await service.from("venue_xp_milestones").insert(milestoneRows);
        if (mErr) return { error: mErr.message };
    }

    revalidatePath("/settings");
    return { ok: true };
}

export async function saveCustomTemplate(name: string, actions: unknown[], milestones: unknown[]) {
    const auth = await getAuthVenue();
    if (!auth) return { error: "Not authenticated" };

    const { error } = await service.from("venue_xp_templates").upsert({
        venue_id: auth.venueId,
        name,
        actions,
        milestones,
        updated_at: new Date().toISOString(),
    }, { onConflict: "venue_id,name" });

    if (error) return { error: error.message };
    revalidatePath("/settings");
    return { ok: true };
}

export async function deleteCustomTemplate(id: string) {
    const auth = await getAuthVenue();
    if (!auth) return { error: "Not authenticated" };

    const { error } = await service
        .from("venue_xp_templates")
        .delete()
        .eq("id", id)
        .eq("venue_id", auth.venueId);

    if (error) return { error: error.message };
    revalidatePath("/settings");
    return { ok: true };
}

export async function deleteXpMilestone(id: string) {
    const auth = await getAuthVenue();
    if (!auth) return { error: "Not authenticated" };

    const { error } = await service
        .from("venue_xp_milestones")
        .delete()
        .eq("id", id)
        .eq("venue_id", auth.venueId);

    if (error) return { error: error.message };
    revalidatePath("/settings");
    return { ok: true };
}

// ─── AI Usage Limits ────────────────────────────────────────────

export async function updateAiLimits(data: {
    free_messages_per_day: number;
    require_membership: boolean;
    gate_message: string;
}) {
    const auth = await getAuthVenue();
    if (!auth) return { error: "Not authenticated" };

    const { error } = await service
        .from("venue_ai_limits")
        .upsert({
            venue_id: auth.venueId,
            free_messages_per_day: data.free_messages_per_day,
            require_membership: data.require_membership,
            gate_message: data.gate_message,
            updated_at: new Date().toISOString(),
        }, { onConflict: "venue_id" });

    if (error) return { error: error.message };
    revalidatePath("/settings");
    return { ok: true };
}

export async function getAiUsageStats() {
    const auth = await getAuthVenue();
    if (!auth) return { error: "Not authenticated" };

    // Today's usage
    const today = new Date().toISOString().split("T")[0];
    const { data: todayUsage } = await service
        .from("ai_usage")
        .select("user_id, device_id, message_count")
        .eq("venue_id", auth.venueId)
        .eq("date", today);

    // Last 7 days total
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
    const { data: weekUsage } = await service
        .from("ai_usage")
        .select("message_count")
        .eq("venue_id", auth.venueId)
        .gte("date", weekAgo);

    const todayMessages = todayUsage?.reduce((sum, r) => sum + r.message_count, 0) || 0;
    const todayGuests = todayUsage?.length || 0;
    const weekMessages = weekUsage?.reduce((sum, r) => sum + r.message_count, 0) || 0;

    return { todayMessages, todayGuests, weekMessages };
}

// ─── Menu Items ─────────────────────────────────────────────────

export async function addMenuItem(data: {
    category: string;
    name: string;
    description?: string;
    price_cents: number;
    inventory_count?: number;
}) {
    const auth = await getAuthVenue();
    if (!auth) return { error: "Not authenticated" };

    const { error } = await service.from("venue_menu_items").insert({
        venue_id: auth.venueId,
        category: data.category || "General",
        name: data.name.trim(),
        description: data.description?.trim() || null,
        price_cents: data.price_cents,
        inventory_count: data.inventory_count ?? null,
        in_stock: true,
    });

    if (error) return { error: error.message };
    revalidatePath("/settings");
    return { ok: true };
}

export async function toggleMenuItemStock(id: string, inStock: boolean) {
    const auth = await getAuthVenue();
    if (!auth) return { error: "Not authenticated" };

    const { error } = await service
        .from("venue_menu_items")
        .update({ in_stock: inStock })
        .eq("id", id)
        .eq("venue_id", auth.venueId);

    if (error) return { error: error.message };
    revalidatePath("/settings");
    return { ok: true };
}

export async function updateMenuItemInventory(id: string, count: number | null) {
    const auth = await getAuthVenue();
    if (!auth) return { error: "Not authenticated" };

    const { error } = await service
        .from("venue_menu_items")
        .update({ inventory_count: count })
        .eq("id", id)
        .eq("venue_id", auth.venueId);

    if (error) return { error: error.message };
    revalidatePath("/settings");
    return { ok: true };
}

export async function deleteMenuItem(id: string) {
    const auth = await getAuthVenue();
    if (!auth) return { error: "Not authenticated" };

    const { error } = await service
        .from("venue_menu_items")
        .delete()
        .eq("id", id)
        .eq("venue_id", auth.venueId);

    if (error) return { error: error.message };
    revalidatePath("/settings");
    return { ok: true };
}

// ─── Digital Asset actions ──────────────────────────────────────

export async function addDigitalAsset(data: {
    name: string;
    asset_type: string;
    category: string;
    description?: string;
    xp_cost?: number;
    point_cost?: number;
    wallet_price_cents?: number;
    cash_price_cents?: number;
    hub_revenue_share?: number;
    min_tier?: string;
    is_animated?: boolean;
    is_3d?: boolean;
    duration_hours?: number;
}) {
    const auth = await getAuthVenue();
    if (!auth) return { error: "Not authenticated" };
    if (!data.name.trim()) return { error: "Name is required" };

    const { error } = await service.from("digital_assets").insert({
        hub_id: auth.venueId,
        name: data.name.trim(),
        asset_type: data.asset_type,
        category: data.category,
        description: data.description?.trim() || null,
        xp_cost: data.xp_cost || null,
        point_cost: data.point_cost || null,
        wallet_price_cents: data.wallet_price_cents || null,
        cash_price_cents: data.cash_price_cents || null,
        hub_revenue_share: data.hub_revenue_share ?? 0.70,
        min_tier: data.min_tier || null,
        is_animated: data.is_animated || false,
        is_3d: data.asset_type === "3d_pin",
        duration_hours: data.duration_hours || null,
    });

    if (error) return { error: error.message };
    revalidatePath("/settings");
    return { ok: true };
}

export async function updateDigitalAsset(id: string, data: {
    name?: string;
    description?: string;
    xp_cost?: number | null;
    point_cost?: number | null;
    wallet_price_cents?: number | null;
    cash_price_cents?: number | null;
    category?: string;
    min_tier?: string | null;
    is_animated?: boolean;
    duration_hours?: number | null;
}) {
    const auth = await getAuthVenue();
    if (!auth) return { error: "Not authenticated" };

    const { error } = await service
        .from("digital_assets")
        .update(data)
        .eq("id", id)
        .eq("hub_id", auth.venueId);

    if (error) return { error: error.message };
    revalidatePath("/settings");
    return { ok: true };
}

export async function toggleDigitalAsset(id: string, active: boolean) {
    const auth = await getAuthVenue();
    if (!auth) return { error: "Not authenticated" };

    const { error } = await service
        .from("digital_assets")
        .update({ active })
        .eq("id", id)
        .eq("hub_id", auth.venueId);

    if (error) return { error: error.message };
    revalidatePath("/settings");
    return { ok: true };
}

export async function deleteDigitalAsset(id: string) {
    const auth = await getAuthVenue();
    if (!auth) return { error: "Not authenticated" };

    const { error } = await service
        .from("digital_assets")
        .delete()
        .eq("id", id)
        .eq("hub_id", auth.venueId);

    if (error) return { error: error.message };
    revalidatePath("/settings");
    return { ok: true };
}
