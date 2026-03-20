import { NextRequest, NextResponse } from "next/server";
import { createClient as createAuthClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// POST /api/wallet/fund — one-time charge to add funds to wallet
// Body: { amountCents } — e.g. 2500 = $25
export async function POST(req: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Payments not configured" }, { status: 503 });
  }

  const authClient = await createAuthClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { amountCents } = await req.json();

  if (!amountCents || typeof amountCents !== "number" || amountCents < 500 || amountCents > 50000) {
    return NextResponse.json({ error: "Amount must be between $5 and $500" }, { status: 400 });
  }

  // Get wallet
  const { data: wallet } = await supabase
    .from("user_wallets")
    .select("id, stripe_customer_id, stripe_payment_method_id")
    .eq("user_id", user.id)
    .single();

  if (!wallet) {
    return NextResponse.json({ error: "No wallet — set one up first" }, { status: 404 });
  }
  if (!wallet.stripe_payment_method_id) {
    return NextResponse.json({ error: "No card on file — add a payment method first" }, { status: 400 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2026-02-25.clover" });

  try {
    // Charge the card
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: "usd",
      customer: wallet.stripe_customer_id!,
      payment_method: wallet.stripe_payment_method_id,
      off_session: true,
      confirm: true,
      description: `KickBack wallet — add ${(amountCents / 100).toFixed(2)}`,
      metadata: { user_id: user.id, wallet_id: wallet.id, type: "fund" },
    });

    if (paymentIntent.status !== "succeeded") {
      return NextResponse.json({ error: "Payment not completed", status: paymentIntent.status }, { status: 402 });
    }

    // Credit the wallet balance (read-then-write for atomicity)
    const { data: current } = await supabase.from("user_wallets").select("balance_cents, spending_limit_cents").eq("id", wallet.id).single();
    const newBalance = (current?.balance_cents || 0) + amountCents;
    await supabase.from("user_wallets").update({
      balance_cents: newBalance,
      spending_limit_cents: Math.max(current?.spending_limit_cents || 0, newBalance),
      updated_at: new Date().toISOString(),
    }).eq("id", wallet.id);

    // Record transaction
    await supabase.from("wallet_transactions").insert({
      wallet_id: wallet.id,
      user_id: user.id,
      amount_cents: amountCents,
      description: `Added funds — $${(amountCents / 100).toFixed(2)}`,
      stripe_payment_intent_id: paymentIntent.id,
      status: "completed",
    });

    // Get updated balance
    const { data: updated } = await supabase.from("user_wallets").select("balance_cents").eq("id", wallet.id).single();

    return NextResponse.json({
      ok: true,
      balanceCents: updated?.balance_cents || amountCents,
      paymentIntentId: paymentIntent.id,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Wallet fund error:", message);
    return NextResponse.json({ error: message }, { status: 402 });
  }
}
