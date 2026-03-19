import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function GET(req: NextRequest) {
  const venueId = req.nextUrl.searchParams.get("venueId");
  if (!venueId) return NextResponse.json({ error: "venueId required" }, { status: 400 });

  const { data, error } = await supabase
    .from("venue_offerings")
    .select("id, type, name, description, price_cents, recurring, interval, perks, duration_minutes, add_ons, category, active")
    .eq("venue_id", venueId)
    .eq("active", true)
    .order("sort_order");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ offerings: data || [] });
}
