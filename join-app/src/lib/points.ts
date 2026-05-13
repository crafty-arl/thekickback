// Server-side points helpers.
// getNextPerkBridge powers the "next perk" line shown after check-in,
// in the points badge, and in the wallet sheet — one consistent ladder.
// Reason copy lives in ./points-copy.ts so client bundles can import it
// without pulling supabase-js.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export { pointsReasonCopy, type PointsReason } from "./points-copy";

export interface NextPerk {
  id: string;
  name: string;
  point_cost: number;
  category: string | null;
}

export interface PerkBridge {
  balance: number;
  nextPerk: NextPerk | null;          // cheapest perk the user can't yet afford
  pointsToNext: number | null;         // null when nextPerk is null
  progressPct: number;                 // 0-100, balance / nextPerk.point_cost
}

let _client: SupabaseClient | null = null;
function svc(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("points: missing SUPABASE_URL or SUPABASE_SERVICE_KEY");
  _client = createClient(url, key, { auth: { persistSession: false } });
  return _client;
}

/**
 * Return the user's current points balance and the next venue perk
 * they're working toward. If no unaffordable perk exists, nextPerk is null
 * (either no perks at this venue, or balance >= cheapest active perk).
 */
export async function getNextPerkBridge(
  userId: string,
  venueId: string,
): Promise<PerkBridge> {
  const client = svc();

  // Parallel: balance + active perks for this venue (asc by cost)
  const [balRes, perksRes] = await Promise.all([
    client.from("point_balances").select("balance").eq("user_id", userId).maybeSingle(),
    client
      .from("venue_perks")
      .select("id, name, point_cost, category")
      .eq("venue_id", venueId)
      .eq("active", true)
      .order("point_cost", { ascending: true }),
  ]);

  const balance = balRes.data?.balance ?? 0;
  const perks = (perksRes.data ?? []) as NextPerk[];

  const nextPerk = perks.find((p) => p.point_cost > balance) ?? null;
  if (!nextPerk) {
    return { balance, nextPerk: null, pointsToNext: null, progressPct: 100 };
  }

  const pointsToNext = nextPerk.point_cost - balance;
  const progressPct = nextPerk.point_cost > 0
    ? Math.max(0, Math.min(100, Math.round((balance / nextPerk.point_cost) * 100)))
    : 100;

  return { balance, nextPerk, pointsToNext, progressPct };
}
