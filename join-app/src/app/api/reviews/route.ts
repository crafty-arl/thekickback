import { NextRequest, NextResponse } from "next/server";
import { createClient as createAuthClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// GET /api/reviews?venueId=X — get reviews for a venue
export async function GET(req: NextRequest) {
  const venueId = req.nextUrl.searchParams.get("venueId");
  if (!venueId) return NextResponse.json({ error: "venueId required" }, { status: 400 });

  const { data: reviews } = await supabase
    .from("venue_reviews")
    .select("id, rating, body, source, created_at, profiles(display_name, email)")
    .eq("venue_id", venueId)
    .order("created_at", { ascending: false })
    .limit(20);

  // Average rating
  const { data: avg } = await supabase
    .from("venue_reviews")
    .select("rating")
    .eq("venue_id", venueId);

  const ratings = (avg || []).map((r: { rating: number }) => r.rating);
  const average = ratings.length > 0 ? ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length : 0;

  return NextResponse.json({
    reviews: (reviews || []).map((r: Record<string, unknown>) => {
      const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
      return {
        id: r.id,
        rating: r.rating,
        body: r.body,
        source: r.source,
        createdAt: r.created_at,
        author: (p as Record<string, unknown>)?.display_name || ((p as Record<string, unknown>)?.email as string)?.split("@")[0] || "Guest",
      };
    }),
    average: Math.round(average * 10) / 10,
    count: ratings.length,
  });
}

// POST /api/reviews — submit or update a review
export async function POST(req: NextRequest) {
  const authClient = await createAuthClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { venueId, rating, body, source } = await req.json();

  if (!venueId || !rating || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "venueId and rating (1-5) required" }, { status: 400 });
  }

  // Upsert — one review per user per venue
  const { data, error } = await supabase
    .from("venue_reviews")
    .upsert({
      venue_id: venueId,
      user_id: user.id,
      rating,
      body: body || null,
      source: source || "app",
      created_at: new Date().toISOString(),
    }, { onConflict: "user_id,venue_id" })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Grant review XP
  try {
    await supabase.rpc("grant_venue_xp", {
      p_user_id: user.id,
      p_venue_id: venueId,
      p_action: "review",
      p_amount: 25,
    });
  } catch { /* XP grant is best-effort */ }

  return NextResponse.json({ ok: true, reviewId: data?.id });
}
