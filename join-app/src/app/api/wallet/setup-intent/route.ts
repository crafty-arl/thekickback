import { NextResponse } from "next/server";
import { createClient as createAuthClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// POST /api/wallet/setup-intent — create a Stripe Checkout Session in setup mode
// Returns a URL to redirect the user to Stripe's hosted card form
export async function POST() {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Payments not configured" }, { status: 503 });
  }

  const authClient = await createAuthClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2026-02-25.clover" });

  // Get or create wallet with Stripe customer
  let { data: wallet } = await supabase
    .from("user_wallets")
    .select("id, stripe_customer_id")
    .eq("user_id", user.id)
    .single();

  if (!wallet) {
    const customer = await stripe.customers.create({
      email: user.email || undefined,
      metadata: { user_id: user.id },
    });

    const { data: newWallet } = await supabase
      .from("user_wallets")
      .insert({
        user_id: user.id,
        stripe_customer_id: customer.id,
        spending_limit_cents: 5000,
      })
      .select("id, stripe_customer_id")
      .single();

    wallet = newWallet;
  }

  if (!wallet?.stripe_customer_id) {
    const customer = await stripe.customers.create({
      email: user.email || undefined,
      metadata: { user_id: user.id },
    });
    await supabase.from("user_wallets").update({ stripe_customer_id: customer.id }).eq("id", wallet!.id);
    wallet!.stripe_customer_id = customer.id;
  }

  try {
    // Create a Checkout Session in setup mode — Stripe hosts the card form
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://join.thekickback.net";

    const session = await stripe.checkout.sessions.create({
      mode: "setup",
      customer: wallet!.stripe_customer_id,
      payment_method_types: ["card"],
      success_url: `${baseUrl}/?wallet=card-saved&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/?wallet=card-cancelled`,
      metadata: { user_id: user.id, wallet_id: wallet!.id },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Setup intent error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
