import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
);

export async function GET(req: NextRequest) {
    const venueId = req.nextUrl.searchParams.get("venueId");
    if (!venueId) return NextResponse.json({ error: "venueId required" }, { status: 400 });

    const { data, error } = await supabase
        .from("digital_assets")
        .select("id, name, asset_type, category, description, preview_url, xp_cost, wallet_price_cents, cash_price_cents, is_animated, min_tier, duration_hours")
        .eq("venue_id", venueId)
        .eq("active", true)
        .order("sort_order");

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ assets: data || [] });
}
