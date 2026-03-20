import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { createClient as createAuthClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { getStripeSecretKey, isSandboxServer } from "@/lib/sandbox";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function getStripe() {
  const h = await headers();
  const { key } = getStripeSecretKey(h);
  if (!key) return null;
  return new Stripe(key, { apiVersion: "2026-02-25.clover" });
}

async function getUser() {
  const authClient = await createAuthClient();
  const { data: { user } } = await authClient.auth.getUser();
  return user;
}

// GET /api/wallet — get wallet status, balance, recent transactions
export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const h = await headers();
  const mode = isSandboxServer(h) ? "test" : "live";

  const { data: wallet } = await supabase
    .from("user_wallets")
    .select("*")
    .eq("user_id", user.id)
    .eq("mode", mode)
    .single();

  if (!wallet) {
    return NextResponse.json({ wallet: null, transactions: [] });
  }

  // Check if period needs reset
  await supabase.rpc("check_wallet_period", { p_wallet_id: wallet.id });

  // Re-read after potential reset
  const { data: fresh } = await supabase
    .from("user_wallets")
    .select("*")
    .eq("id", wallet.id)
    .single();

  // Recent transactions
  const { data: transactions } = await supabase
    .from("wallet_transactions")
    .select("id, amount_cents, description, status, venue_id, created_at, venues(name)")
    .eq("user_id", user.id)
    .eq("mode", mode)
    .order("created_at", { ascending: false })
    .limit(20);

  const remaining = (fresh?.spending_limit_cents || 0) - (fresh?.spent_this_period_cents || 0);

  return NextResponse.json({
    wallet: fresh ? {
      id: fresh.id,
      balanceCents: fresh.balance_cents || 0,
      spendingLimitCents: fresh.spending_limit_cents,
      spentThisPeriodCents: fresh.spent_this_period_cents,
      remainingCents: Math.max(0, remaining),
      period: fresh.period,
      periodStartedAt: fresh.period_started_at,
      hasCard: !!fresh.stripe_payment_method_id,
      cardLast4: fresh.card_last4,
      cardBrand: fresh.card_brand,
      autoReload: fresh.auto_reload,
      autoReloadAmountCents: fresh.auto_reload_amount_cents,
      active: fresh.active,
    } : null,
    transactions: (transactions || []).map((t: Record<string, unknown>) => {
      const venue = Array.isArray(t.venues) ? t.venues[0] : t.venues;
      return {
        id: t.id,
        amountCents: t.amount_cents,
        description: t.description,
        status: t.status,
        venueName: (venue as Record<string, unknown>)?.name || null,
        createdAt: t.created_at,
      };
    }),
  });
}

// POST /api/wallet — create or update wallet settings
// Body: { spendingLimitCents, period, autoReload, autoReloadAmountCents }
export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json();
  const {
    spendingLimitCents,
    period,
    autoReload,
    autoReloadAmountCents,
  } = body;

  // Validate
  if (spendingLimitCents !== undefined && (typeof spendingLimitCents !== "number" || spendingLimitCents < 0)) {
    return NextResponse.json({ error: "Invalid spending limit" }, { status: 400 });
  }
  if (period && !["daily", "weekly", "monthly"].includes(period)) {
    return NextResponse.json({ error: "Invalid period" }, { status: 400 });
  }

  const stripe = await getStripe();

  const h2 = await headers();
  const mode = isSandboxServer(h2) ? "test" : "live";

  // Check if wallet exists
  const { data: existing } = await supabase
    .from("user_wallets")
    .select("id, stripe_customer_id")
    .eq("user_id", user.id)
    .eq("mode", mode)
    .single();

  if (existing) {
    // Update existing wallet
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (spendingLimitCents !== undefined) updates.spending_limit_cents = spendingLimitCents;
    if (period) updates.period = period;
    if (autoReload !== undefined) updates.auto_reload = autoReload;
    if (autoReloadAmountCents !== undefined) updates.auto_reload_amount_cents = autoReloadAmountCents;

    await supabase.from("user_wallets").update(updates).eq("id", existing.id);
    return NextResponse.json({ ok: true, walletId: existing.id });
  }

  // Create new wallet + Stripe customer
  let stripeCustomerId: string | null = null;
  if (stripe) {
    try {
      const customer = await stripe.customers.create({
        email: user.email || undefined,
        metadata: { user_id: user.id },
      });
      stripeCustomerId = customer.id;
    } catch (err) {
      console.error("Stripe customer creation error:", err);
    }
  }

  const { data: wallet, error } = await supabase
    .from("user_wallets")
    .insert({
      user_id: user.id,
      stripe_customer_id: stripeCustomerId,
      spending_limit_cents: spendingLimitCents || 5000, // default $50
      period: period || "weekly",
      auto_reload: autoReload || false,
      auto_reload_amount_cents: autoReloadAmountCents || 0,
      mode,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Wallet creation error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, walletId: wallet.id });
}
