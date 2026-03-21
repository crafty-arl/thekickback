import { NextRequest, NextResponse } from "next/server";
import { createClient as createAuthClient } from "@/lib/supabase/server";

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
  // Verify authenticated user from session cookie
  const supabase = await createAuthClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const userId = user.id;
  const venueId = req.nextUrl.searchParams.get("venueId");
  const wantMemberships = req.nextUrl.searchParams.get("memberships") === "true";

  const queries: Promise<unknown>[] = [
    // KickBack score (aggregate)
    supabaseGet(`point_balances?user_id=eq.${userId}&select=*`),

    // All venue XP profiles for this user (for badge collection)
    supabaseGet(
      `user_venue_xp?user_id=eq.${userId}&select=*,venues(id,name,vibe),venue_xp_milestones(name,color,threshold)&order=xp.desc`
    ),

    // Active challenges
    supabaseGet(`challenges?active=eq.true&select=*`),

    // Recent transaction history (last 30 entries)
    supabaseGet(
      `point_ledger?user_id=eq.${userId}&select=id,amount,reason,venue_id,venues(name),created_at&order=created_at.desc&limit=30`
    ),
  ];

  // If viewing a specific venue, also fetch venue-specific data
  if (venueId) {
    queries.push(
      // This venue's XP actions (what earns XP here)
      supabaseGet(`venue_xp_actions?venue_id=eq.${venueId}&active=eq.true&order=sort_order.asc&select=*`),
      // This venue's milestones
      supabaseGet(`venue_xp_milestones?venue_id=eq.${venueId}&order=threshold.asc&select=*`),
      // User's XP at this venue
      supabaseGet(`user_venue_xp?user_id=eq.${userId}&venue_id=eq.${venueId}&select=*`),
      // Perks at this venue
      supabaseGet(`venue_perks?venue_id=eq.${venueId}&active=eq.true&order=sort_order.asc&select=*`),
    );
  }

  const results = await Promise.all(queries);

  const [balanceRes, venueXpProfiles, challenges, ledgerRes] = results as [
    Record<string, unknown>[],
    Record<string, unknown>[],
    Record<string, unknown>[],
    Record<string, unknown>[],
  ];

  const kickbackScore =
    Array.isArray(balanceRes) && balanceRes.length > 0
      ? balanceRes[0]
      : {
          balance: 0,
          total_earned: 0,
          total_spent: 0,
          tier: "explorer",
          venues_visited: 0,
          current_streak: 0,
          kickback_score: 0,
        };

  const response: Record<string, unknown> = {
    balance: kickbackScore,
    venueProfiles: Array.isArray(venueXpProfiles) ? venueXpProfiles : [],
    challenges: Array.isArray(challenges) ? challenges : [],
    history: Array.isArray(ledgerRes) ? ledgerRes : [],
  };

  if (venueId) {
    const [xpActions, milestones, venueXp, perks] = results.slice(3) as [
      Record<string, unknown>[],
      Record<string, unknown>[],
      Record<string, unknown>[],
      Record<string, unknown>[],
    ];

    response.venueXpActions = Array.isArray(xpActions) ? xpActions : [];
    response.venueMilestones = Array.isArray(milestones) ? milestones : [];
    response.venueXp = Array.isArray(venueXp) && venueXp.length > 0 ? venueXp[0] : { xp: 0, visits: 0 };
    response.perks = Array.isArray(perks) ? perks : [];
  }

  // Fetch memberships if requested
  if (wantMemberships) {
    const memberRows = await supabaseGet(
      `memberships?user_id=eq.${userId}&select=venue_id,tier,expires_at,venues(name)&expires_at=gt.${new Date().toISOString()}`
    );
    response.memberships = (Array.isArray(memberRows) ? memberRows : []).map((m: Record<string, unknown>) => {
      const v = Array.isArray(m.venues) ? m.venues[0] : m.venues;
      return { venue_id: m.venue_id, venue_name: (v as Record<string, unknown>)?.name || "Venue", tier: m.tier, expires_at: m.expires_at };
    });
  }

  return NextResponse.json(response);
}
