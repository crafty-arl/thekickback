import { NextResponse } from "next/server";
import { createClient as createAuthClient } from "@/lib/supabase/server";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY!;

export const dynamic = "force-dynamic";

async function supabaseGet(path: string) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
        },
    });
    return res.json();
}

export async function GET() {
    const supabase = await createAuthClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Fetch user's unlocked assets joined with asset details
    const unlocks = await supabaseGet(
        `asset_unlocks?user_id=eq.${user.id}&select=id,asset_id,payment_method,xp_spent,points_spent,amount_charged_cents,unlocked_at,digital_assets(id,name,asset_type,category,description,asset_url,hub_id,is_animated,is_3d,duration_hours)&order=unlocked_at.desc`
    );

    if (!Array.isArray(unlocks)) {
        return NextResponse.json({ collectibles: [] });
    }

    // Gather unique venue IDs to fetch venue names
    const hubIds = new Set<string>();
    for (const u of unlocks) {
        const asset = Array.isArray(u.digital_assets) ? u.digital_assets[0] : u.digital_assets;
        if (asset?.hub_id) hubIds.add(asset.hub_id);
    }

    // Fetch venue names for grouping
    let venueNames: Record<string, string> = {};
    if (hubIds.size > 0) {
        const ids = Array.from(hubIds).join(",");
        const venues = await supabaseGet(`venues?id=in.(${ids})&select=id,name`);
        if (Array.isArray(venues)) {
            venueNames = Object.fromEntries(venues.map((v: { id: string; name: string }) => [v.id, v.name]));
        }
    }

    // Flatten into a clean response
    const collectibles = unlocks.map((u: Record<string, unknown>) => {
        const asset = (Array.isArray(u.digital_assets) ? u.digital_assets[0] : u.digital_assets) as Record<string, unknown> | null;
        return {
            unlock_id: u.id,
            asset_id: u.asset_id,
            name: asset?.name || "Unknown",
            asset_type: asset?.asset_type || "sticker",
            category: asset?.category || "custom",
            description: asset?.description || null,
            is_animated: asset?.is_animated || false,
            hub_id: asset?.hub_id || null,
            hub_name: asset?.hub_id ? venueNames[asset.hub_id as string] || "Venue" : "Network",
            payment_method: u.payment_method,
            unlocked_at: u.unlocked_at,
        };
    });

    return NextResponse.json({ collectibles });
}
