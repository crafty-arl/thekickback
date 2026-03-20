import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { createClient as createAuthClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { getStripeSecretKey } from "@/lib/sandbox";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// POST /api/wallet/confirm-card — save card from completed Checkout Session
// Body: { sessionId } — the Stripe Checkout Session ID from the redirect URL
export async function POST(req: NextRequest) {
  const h = await headers();
  const { key } = getStripeSecretKey(h);
  if (!key) {
    return NextResponse.json({ error: "Payments not configured" }, { status: 503 });
  }

  const authClient = await createAuthClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { sessionId } = await req.json();
  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
  }

  const stripe = new Stripe(key, { apiVersion: "2026-02-25.clover" });

  try {
    // Retrieve the checkout session to get the SetupIntent
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["setup_intent"],
    });

    const setupIntent = session.setup_intent as Stripe.SetupIntent;
    if (!setupIntent?.payment_method) {
      return NextResponse.json({ error: "No payment method found" }, { status: 400 });
    }

    const paymentMethodId = typeof setupIntent.payment_method === "string"
      ? setupIntent.payment_method
      : setupIntent.payment_method.id;

    // Retrieve payment method details
    const pm = await stripe.paymentMethods.retrieve(paymentMethodId);

    // Get wallet
    const { data: wallet } = await supabase
      .from("user_wallets")
      .select("id, stripe_customer_id")
      .eq("user_id", user.id)
      .single();

    if (!wallet) {
      return NextResponse.json({ error: "No wallet found" }, { status: 404 });
    }

    // Set as default payment method
    if (wallet.stripe_customer_id) {
      await stripe.customers.update(wallet.stripe_customer_id, {
        invoice_settings: { default_payment_method: paymentMethodId },
      });
    }

    // Save card details to wallet
    await supabase.from("user_wallets").update({
      stripe_payment_method_id: paymentMethodId,
      card_last4: pm.card?.last4 || null,
      card_brand: pm.card?.brand || null,
      active: true,
      updated_at: new Date().toISOString(),
    }).eq("id", wallet.id);

    return NextResponse.json({
      ok: true,
      card: { last4: pm.card?.last4, brand: pm.card?.brand },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Confirm card error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
