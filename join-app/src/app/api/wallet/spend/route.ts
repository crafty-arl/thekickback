import { NextRequest, NextResponse } from "next/server";
import { createClient as createAuthClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// POST /api/wallet/spend — charge the user's wallet for an order
// Body: { amountCents, venueId, orderId?, description? }
// Called internally by the orders flow when wallet is active
export async function POST(req: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Payments not configured" }, { status: 503 });
  }

  const authClient = await createAuthClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { amountCents, venueId, orderId, description } = await req.json();

  if (!amountCents || amountCents <= 0) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }
  if (!venueId) {
    return NextResponse.json({ error: "Missing venueId" }, { status: 400 });
  }

  // Check wallet spending limit via DB function
  const { data: result } = await supabase.rpc("wallet_spend", {
    p_user_id: user.id,
    p_amount_cents: amountCents,
    p_venue_id: venueId,
    p_order_id: orderId || null,
    p_description: description || null,
  });

  if (!result?.ok) {
    return NextResponse.json({
      error: result?.error || "Wallet spend failed",
      remainingCents: result?.remaining_cents,
    }, { status: 400 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2026-02-25.clover" });

  // Get venue's Stripe Connect account for destination charge
  const { data: venue } = await supabase
    .from("venues")
    .select("stripe_account_id, platform_fee_rate")
    .eq("id", venueId)
    .single();

  try {
    // Create PaymentIntent — charge customer, transfer to venue
    const paymentParams: Stripe.PaymentIntentCreateParams = {
      amount: amountCents,
      currency: "usd",
      customer: result.stripe_customer_id,
      payment_method: result.stripe_payment_method_id,
      off_session: true,  // AI is spending on behalf of user
      confirm: true,
      description: description || `KickBack order`,
      metadata: {
        user_id: user.id,
        venue_id: venueId,
        order_id: orderId || "",
        wallet_id: result.wallet_id,
        transaction_id: result.transaction_id,
      },
    };

    // If venue has Stripe Connect, use destination charge
    if (venue?.stripe_account_id) {
      const feeRate = venue.platform_fee_rate || 0.10;
      const applicationFee = Math.round(amountCents * feeRate);
      paymentParams.transfer_data = { destination: venue.stripe_account_id };
      paymentParams.application_fee_amount = applicationFee;
    }

    const paymentIntent = await stripe.paymentIntents.create(paymentParams);

    // Update transaction with Stripe IDs
    await supabase.from("wallet_transactions").update({
      stripe_payment_intent_id: paymentIntent.id,
      status: paymentIntent.status === "succeeded" ? "completed" : "pending",
    }).eq("id", result.transaction_id);

    return NextResponse.json({
      ok: true,
      transactionId: result.transaction_id,
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status,
      remainingCents: result.remaining_cents,
    });
  } catch (err) {
    // Payment failed — reverse the wallet spend
    await supabase.from("wallet_transactions").update({ status: "failed" }).eq("id", result.transaction_id);
    // Decrement spent amount back
    const { data: currentWallet } = await supabase.from("user_wallets").select("spent_this_period_cents").eq("id", result.wallet_id).single();
    if (currentWallet) {
      await supabase.from("user_wallets").update({
        spent_this_period_cents: Math.max(0, currentWallet.spent_this_period_cents - amountCents),
      }).eq("id", result.wallet_id);
    }

    const message = err instanceof Error ? err.message : String(err);
    console.error("Wallet spend payment error:", message);
    return NextResponse.json({ error: `Payment failed: ${message}` }, { status: 402 });
  }
}
