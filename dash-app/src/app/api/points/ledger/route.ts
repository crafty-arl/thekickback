// Owner-authenticated point_ledger view for a venue.
// Powers the "Why this customer got these" drawer in the dash points panel —
// the defensibility guardrail. Optional userId narrows to a single guest.

import { NextRequest, NextResponse } from "next/server";
import { createClient as createAuthClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { pointsReasonCopy } from "@/lib/points-copy";

// Lazy service client — env vars aren't set during `next build` page-data
// collection. Top-level createClient throws "supabaseKey is required".
function getService() {
  return createServiceClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );
}

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const venueId = req.nextUrl.searchParams.get("venueId");
  const userId = req.nextUrl.searchParams.get("userId");
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") || "50", 10) || 50, 200);

  if (!venueId) {
    return NextResponse.json({ error: "venueId required" }, { status: 400 });
  }

  const supabase = await createAuthClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }

  // Authorize: owner of this venue only
  const { data: ownership } = await getService()
    .from("venue_owners")
    .select("venue_id")
    .eq("user_id", user.id)
    .eq("venue_id", venueId)
    .maybeSingle();

  if (!ownership) {
    return NextResponse.json({ error: "not authorized" }, { status: 403 });
  }

  let query = getService()
    .from("point_ledger")
    .select("id, user_id, amount, reason, reference_id, created_at, profiles(display_name, email, phone)")
    .eq("venue_id", venueId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (userId) query = query.eq("user_id", userId);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  type Row = {
    id: string;
    user_id: string;
    amount: number;
    reason: string;
    reference_id: string | null;
    created_at: string;
    profiles: { display_name: string | null; email: string | null; phone: string | null } | null;
  };

  const rows = (data ?? []).map((r) => {
    const row = r as unknown as Row;
    const p = row.profiles;
    const guest_label = p?.display_name || p?.email || p?.phone || "Guest";
    return {
      id: row.id,
      user_id: row.user_id,
      amount: row.amount,
      reason: row.reason,
      reason_copy: pointsReasonCopy(row.reason),
      reference_id: row.reference_id,
      created_at: row.created_at,
      guest_label,
    };
  });

  return NextResponse.json({ entries: rows });
}
