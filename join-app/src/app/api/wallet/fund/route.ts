import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { createClient as createAuthClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { getStripeSecretKey, isSandboxServer } from "@/lib/sandbox";
import { sendEmail, wrap } from "@/lib/email";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// POST /api/wallet/fund — one-time charge to add funds to wallet
// Body: { amountCents } — e.g. 2500 = $25
export async function POST(req: NextRequest) {
  const h = await headers();
  const { key } = getStripeSecretKey(h);
  const mode = isSandboxServer(h) ? "test" : "live";
  if (!key) {
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
    .select("id, stripe_customer_id, stripe_payment_method_id, card_last4")
    .eq("user_id", user.id)
    .eq("mode", mode)
    .single();

  if (!wallet) {
    return NextResponse.json({ error: "No wallet — set one up first" }, { status: 404 });
  }
  if (!wallet.stripe_payment_method_id) {
    return NextResponse.json({ error: "No card on file — add a payment method first" }, { status: 400 });
  }

  const stripe = new Stripe(key, { apiVersion: "2026-02-25.clover" });

  // Verify customer exists in current Stripe mode
  if (wallet.stripe_customer_id) {
    try {
      await stripe.customers.retrieve(wallet.stripe_customer_id);
    } catch {
      // Customer from other mode — create new one
      const customer = await stripe.customers.create({
        email: user.email || undefined,
        metadata: { user_id: user.id },
      });
      // Re-attach payment method to new customer
      try {
        await stripe.paymentMethods.attach(wallet.stripe_payment_method_id, { customer: customer.id });
      } catch {
        return NextResponse.json({ error: "Card not valid in this mode — please add a new card" }, { status: 400 });
      }
      await supabase.from("user_wallets").update({ stripe_customer_id: customer.id }).eq("id", wallet.id);
      wallet.stripe_customer_id = customer.id;
    }
  }

  try {
    // Calculate fees
    const stripeFee = Math.round(amountCents * 0.029) + 30; // 2.9% + 30¢
    const platformFee = Math.round(amountCents * 0.02);      // 2%
    const totalCharge = amountCents + stripeFee + platformFee;

    // Charge the card (total including fees)
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalCharge,
      currency: "usd",
      customer: wallet.stripe_customer_id!,
      payment_method: wallet.stripe_payment_method_id,
      off_session: true,
      confirm: true,
      description: `KB Wallet — add $${(amountCents / 100).toFixed(2)} (incl. fees)`,
      metadata: {
        user_id: user.id, wallet_id: wallet.id, type: "fund",
        wallet_credit_cents: String(amountCents),
        stripe_fee_cents: String(stripeFee),
        platform_fee_cents: String(platformFee),
      },
    });

    // Handle non-succeeded states
    if (paymentIntent.status === "requires_action" || paymentIntent.status === "requires_confirmation") {
      return NextResponse.json({
        error: "Your card requires additional verification. Please try a different card.",
        status: paymentIntent.status,
      }, { status: 402 });
    }

    if (paymentIntent.status !== "succeeded") {
      return NextResponse.json({
        error: `Payment ${paymentIntent.status}. Your card was not charged.`,
        status: paymentIntent.status,
      }, { status: 402 });
    }

    // Double-check by retrieving the PaymentIntent
    const verified = await stripe.paymentIntents.retrieve(paymentIntent.id);
    if (verified.status !== "succeeded") {
      return NextResponse.json({
        error: "Payment could not be verified. Your card was not charged.",
      }, { status: 402 });
    }

    // Payment confirmed — credit the wallet balance
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
      stripe_payment_intent_id: verified.id,
      status: "completed",
      mode,
    });

    // Get updated balance
    const { data: updated } = await supabase.from("user_wallets").select("balance_cents").eq("id", wallet.id).single();

    // Send wallet funded email
    if (user.email) {
      const bal = ((updated?.balance_cents || newBalance) / 100).toFixed(2);
      const added = (amountCents / 100).toFixed(2);
      const sFee = (stripeFee / 100).toFixed(2);
      const pFee = (platformFee / 100).toFixed(2);
      const total = (totalCharge / 100).toFixed(2);
      const last4 = wallet.card_last4 || "****";
      sendEmail(user.email, `$${added} added to your KB Wallet`, wrap(`
        <div style="text-align:center;margin-bottom:24px;">
          <p style="font-size:48px;font-weight:700;margin:0;color:#fff;">$${bal}</p>
          <p style="font-size:15px;color:#4ADE80;margin:4px 0 0;font-weight:600;">+$${added} added</p>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:13px;color:rgba(255,255,255,0.6);">
          <tr><td style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.08);">Amount</td><td style="text-align:right;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:#fff;">$${added}</td></tr>
          <tr><td style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.08);">Processing fee</td><td style="text-align:right;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.08);">$${sFee}</td></tr>
          <tr><td style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.08);">Platform fee</td><td style="text-align:right;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.08);">$${pFee}</td></tr>
          <tr><td style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.08);font-weight:600;color:#fff;">Card charged</td><td style="text-align:right;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.08);font-weight:600;color:#fff;">$${total}</td></tr>
          <tr><td style="padding:8px 0;">Card</td><td style="text-align:right;padding:8px 0;">**** ${last4}</td></tr>
        </table>
        <p style="margin-top:24px;font-size:13px;color:rgba(255,255,255,0.4);text-align:center;">
          Your balance is ready to spend at any venue on theKickBack.
        </p>
      `));
    }

    return NextResponse.json({
      ok: true,
      balanceCents: updated?.balance_cents || amountCents,
      paymentIntentId: paymentIntent.id,
    });
  } catch (err: unknown) {
    const stripeErr = err as { type?: string; code?: string; decline_code?: string; message?: string };
    console.error("Wallet fund error:", stripeErr.message, stripeErr.code, stripeErr.decline_code);

    // User-friendly error messages for common Stripe failures
    let userMessage = "Payment failed. Your card was not charged.";
    if (stripeErr.code === "card_declined") {
      userMessage = stripeErr.decline_code === "insufficient_funds"
        ? "Insufficient funds. Please try a different card."
        : "Your card was declined. Please try a different card.";
    } else if (stripeErr.code === "expired_card") {
      userMessage = "Your card has expired. Please update your payment method.";
    } else if (stripeErr.code === "incorrect_cvc") {
      userMessage = "Card verification failed. Please re-add your card.";
    } else if (stripeErr.code === "processing_error") {
      userMessage = "Processing error. Please try again in a moment.";
    } else if (stripeErr.message) {
      userMessage = stripeErr.message;
    }

    return NextResponse.json({ error: userMessage }, { status: 402 });
  }
}
