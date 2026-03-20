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

  const [pageRes, galleryRes] = await Promise.all([
    supabase
      .from("venue_pages")
      .select("tagline, description, theme_color, hero_image, hours, menu_sections")
      .eq("venue_id", venueId)
      .single(),
    supabase
      .from("venue_gallery")
      .select("id, image_url, caption, sort_order")
      .eq("venue_id", venueId)
      .order("sort_order"),
  ]);

  return NextResponse.json({
    page: pageRes.data || null,
    gallery: galleryRes.data || [],
  });
}
