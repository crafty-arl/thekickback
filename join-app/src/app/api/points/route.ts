import { NextRequest, NextResponse } from "next/server";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY!;

async function supabaseGet(path: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  });
  return res.json();
}

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  const venueId = req.nextUrl.searchParams.get("venueId");

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  // Fetch balance, venue perks, active challenges, and user's recent points at this venue
  const [balance, perks, challenges, recentPoints] = await Promise.all([
    // User's point balance
    supabaseGet(`point_balances?user_id=eq.${userId}&select=*`),

    // Perks at this venue (if venueId provided)
    venueId
      ? supabaseGet(`venue_perks?venue_id=eq.${venueId}&active=eq.true&order=sort_order.asc&select=*`)
      : Promise.resolve([]),

    // Active challenges
    supabaseGet(`challenges?active=eq.true&select=*`),

    // Recent point events for this user at this venue
    venueId
      ? supabaseGet(
          `point_ledger?user_id=eq.${userId}&venue_id=eq.${venueId}&order=created_at.desc&limit=10&select=*`
        )
      : Promise.resolve([]),
  ]);

  const userBalance = Array.isArray(balance) && balance.length > 0
    ? balance[0]
    : { balance: 0, total_earned: 0, total_spent: 0, tier: "explorer", venues_visited: 0, current_streak: 0 };

  return NextResponse.json({
    balance: userBalance,
    perks: Array.isArray(perks) ? perks : [],
    challenges: Array.isArray(challenges) ? challenges : [],
    recentPoints: Array.isArray(recentPoints) ? recentPoints : [],
  });
}
