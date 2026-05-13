// Client-callable loop-events emit endpoint.
// Used for events the browser knows about (chat_action_clicked, perk_viewed)
// that the server-side route handlers can't observe.

import { NextRequest, NextResponse } from "next/server";
import { createClient as createAuthClient } from "@/lib/supabase/server";
import { emit, type LoopEvent } from "@/lib/loop-events";

const ALLOWED: LoopEvent[] = [
  "chat_open",
  "chat_action_clicked",
  "perk_viewed",
  "wallet_pass_viewed",
  "points_earned_view",
];

interface Body {
  event: LoopEvent;
  venueId?: string | null;
  properties?: Record<string, unknown>;
}

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (!body?.event || !ALLOWED.includes(body.event)) {
    return NextResponse.json({ error: "event not allowed" }, { status: 400 });
  }

  const supabase = await createAuthClient();
  const { data: { user } } = await supabase.auth.getUser();

  emit({
    event: body.event,
    source: "join",
    userId: user?.id ?? null,
    venueId: body.venueId ?? null,
    properties: body.properties ?? {},
  });

  return NextResponse.json({ ok: true });
}
