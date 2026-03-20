import { NextResponse } from "next/server";
import { createClient as createAuthClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// POST /api/wallet/setup-intent — create a Stripe SetupIntent for saving a card
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
    // Create wallet + Stripe customer
    const customer = await stripe.customers.create({
      email: user.email || undefined,
      metadata: { user_id: user.id },
    });

    const { data: newWallet } = await supabase
      .from("user_wallets")
      .insert({
        user_id: user.id,
        stripe_customer_id: customer.id,
        spending_limit_cents: 5000, // default $50
      })
      .select("id, stripe_customer_id")
      .single();

    wallet = newWallet;
  }

  if (!wallet?.stripe_customer_id) {
    // Create Stripe customer for existing wallet without one
    const customer = await stripe.customers.create({
      email: user.email || undefined,
      metadata: { user_id: user.id },
    });
    await supabase.from("user_wallets").update({ stripe_customer_id: customer.id }).eq("id", wallet!.id);
    wallet!.stripe_customer_id = customer.id;
  }

  // Create SetupIntent
  const setupIntent = await stripe.setupIntents.create({
    customer: wallet!.stripe_customer_id,
    payment_method_types: ["card"],
    metadata: { user_id: user.id, wallet_id: wallet!.id },
  });

  return NextResponse.json({
    clientSecret: setupIntent.client_secret,
    walletId: wallet!.id,
  });
}
