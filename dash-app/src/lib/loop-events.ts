// Phase 0 loop telemetry — server-only.
// Fire-and-forget: emit() and recordChatCost() never throw. Telemetry
// failures must not break the request path.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type LoopEvent =
  | "chat_open"
  | "chat_message_sent"
  | "chat_action_clicked"
  | "checkin_started"
  | "checkin_completed"
  | "points_earned_view"
  | "perk_viewed"
  | "perk_redeemed"
  | "wallet_pass_viewed"
  | "return_visit_prompted"
  | "return_visit_unprompted";

export type LoopSource = "join" | "dash" | "root" | "system";

export interface EmitContext {
  event: LoopEvent;
  source: LoopSource;
  userId?: string | null;
  venueId?: string | null;
  deviceId?: string | null;
  properties?: Record<string, unknown>;
}

export interface ChatCostContext {
  source: LoopSource;
  model: string;
  venueId?: string | null;
  userId?: string | null;
  tokensIn?: number | null;
  tokensOut?: number | null;
  costMicros?: number | null;   // pre-computed; otherwise derived via chatCostMicros()
  estimated?: boolean;
}

let _client: SupabaseClient | null = null;
function svc(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("loop-events: missing SUPABASE_URL or SUPABASE_SERVICE_KEY");
  _client = createClient(url, key, { auth: { persistSession: false } });
  return _client;
}

export function emit(ctx: EmitContext): void {
  try {
    svc()
      .from("loop_events")
      .insert({
        user_id: ctx.userId ?? null,
        venue_id: ctx.venueId ?? null,
        event: ctx.event,
        source: ctx.source,
        device_id: ctx.deviceId ?? null,
        properties: ctx.properties ?? {},
      })
      .then(
        (res) => {
          if (res.error) console.warn("[loop-events] insert error:", res.error.message, ctx.event);
        },
        (err) => console.warn("[loop-events] threw:", err)
      );
  } catch (err) {
    console.warn("[loop-events] emit threw:", err);
  }
}

// Per-million-token USD prices. Update as model pricing changes.
// Cost in micros per token = USD per million tokens (since 1 USD = 1,000,000 micros).
const PRICE_PER_MILLION: Record<string, { in: number; out: number }> = {
  openclaw: { in: 1, out: 5 }, // placeholder gateway pricing — calibrate from real billing
  "openrouter/anthropic/claude-sonnet-4": { in: 3, out: 15 },
  "anthropic/claude-sonnet-4": { in: 3, out: 15 },
};

export function chatCostMicros(model: string, tokensIn: number, tokensOut: number): number | null {
  const p = PRICE_PER_MILLION[model];
  if (!p) return null;
  return Math.round(tokensIn * p.in + tokensOut * p.out);
}

// Rough char-based token estimate when provider does not return usage.
// 4 chars/token is a standard ballpark.
export function estimateTokens(text: string): number {
  return Math.ceil((text?.length || 0) / 4);
}

export function recordChatCost(ctx: ChatCostContext): void {
  try {
    let cost = ctx.costMicros ?? null;
    let estimated = ctx.estimated ?? false;
    if (cost == null && ctx.tokensIn != null && ctx.tokensOut != null) {
      cost = chatCostMicros(ctx.model, ctx.tokensIn, ctx.tokensOut);
      if (cost != null && ctx.costMicros == null) estimated = false;
    }
    svc()
      .from("chat_cost_log")
      .insert({
        venue_id: ctx.venueId ?? null,
        user_id: ctx.userId ?? null,
        source: ctx.source,
        model: ctx.model,
        tokens_in: ctx.tokensIn ?? null,
        tokens_out: ctx.tokensOut ?? null,
        cost_micros: cost,
        estimated,
      })
      .then(
        (res) => {
          if (res.error) console.warn("[loop-events] chat_cost_log error:", res.error.message);
        },
        (err) => console.warn("[loop-events] chat_cost_log threw:", err)
      );
  } catch (err) {
    console.warn("[loop-events] recordChatCost threw:", err);
  }
}
