// Phase 2: vibe drop submission.
// Light-touch contribution tied to a check-in moment. Inserts a row,
// grants vibe_drop points via the existing protocol, fires loop telemetry.

import { NextRequest, NextResponse } from "next/server";
import { createClient as createAuthClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { emit } from "@/lib/loop-events";

const VIBE_DROP_POINTS = 25;
const VALID_SENTIMENTS = ["quiet", "moderate", "busy", "packed"] as const;

// Lazy service client — env vars aren't set during `next build` page-data
// collection. Top-level createClient throws "supabaseKey is required".
function getService() {
  return createServiceClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );
}

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: { venueId?: string; body?: string; sentiment?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const venueId = body.venueId?.trim();
  const text = body.body?.trim();
  const sentiment = body.sentiment && (VALID_SENTIMENTS as readonly string[]).includes(body.sentiment)
    ? body.sentiment
    : null;

  if (!venueId) return NextResponse.json({ error: "venueId required" }, { status: 400 });
  if (!text) return NextResponse.json({ error: "body required" }, { status: 400 });
  if (text.length > 280) return NextResponse.json({ error: "body too long" }, { status: 400 });

  const supabase = await createAuthClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not authenticated" }, { status: 401 });

  const service = getService();
  // Insert the drop
  const { data: drop, error: insertErr } = await service
    .from("vibe_drops")
    .insert({
      user_id: user.id,
      venue_id: venueId,
      body: text,
      sentiment,
    })
    .select("id")
    .single();

  if (insertErr || !drop) {
    return NextResponse.json({ error: insertErr?.message ?? "failed to save" }, { status: 500 });
  }

  // Grant points via the existing protocol (handles multiplier + balance update)
  let newBalance: number | null = null;
  try {
    const { data: balanceAfter } = await service.rpc("grant_points", {
      p_user_id: user.id,
      p_venue_id: venueId,
      p_amount: VIBE_DROP_POINTS,
      p_reason: "vibe_drop",
      p_reference_id: drop.id,
    });
    if (typeof balanceAfter === "number") newBalance = balanceAfter;
  } catch (err) {
    console.error("vibe_drop grant_points error:", err);
  }

  emit({
    event: "chat_action_clicked", // closest existing enum value for "user contributed"
    source: "join",
    userId: user.id,
    venueId,
    properties: {
      kind: "vibe_drop",
      drop_id: drop.id,
      sentiment,
      length: text.length,
      points_granted: VIBE_DROP_POINTS,
    },
  });

  return NextResponse.json({
    ok: true,
    dropId: drop.id,
    pointsGranted: VIBE_DROP_POINTS,
    newBalance,
  });
}
