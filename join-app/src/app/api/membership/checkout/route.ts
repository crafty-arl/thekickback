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

// POST /api/membership/checkout — create a Stripe Checkout session for a membership offering
export async function POST(req: NextRequest) {
  const h = await headers();
  const { key } = getStripeSecretKey(h);
  if (!key) {
    return NextResponse.json({ error: "Payments not configured" }, { status: 503 });
  }

  const authClient = await createAuthClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { offeringId, venueId } = await req.json();
  if (!offeringId || !venueId) {
    return NextResponse.json({ error: "Missing offeringId or venueId" }, { status: 400 });
  }

  // Check if venue has Stripe connected
  const mode = isSandboxServer(h) ? "test" : "live";
  const accountCol = mode === "test" ? "stripe_test_account_id" : "stripe_account_id";
  const { data: venueStripe } = await supabase
    .from("venues")
    .select(accountCol)
    .eq("id", venueId)
    .single();

  if (!venueStripe || !(venueStripe as Record<string, unknown>)[accountCol]) {
    return NextResponse.json({ error: "This place hasn't set up payments yet." }, { status: 400 });
  }

  // Fetch offering — must be active membership
  const { data: offering, error: offErr } = await supabase
    .from("venue_offerings")
    .select("id, name, price_cents, interval, recurring, active, stripe_price_id, venue_id")
    .eq("id", offeringId)
    .eq("venue_id", venueId)
    .single();

  if (offErr || !offering) {
    return NextResponse.json({ error: "Offering not found" }, { status: 404 });
  }
  if (!offering.active) {
    return NextResponse.json({ error: "Offering is not active" }, { status: 400 });
  }

  // Fetch venue for naming
  const { data: venue } = await supabase
    .from("venues")
    .select("name, slug")
    .eq("id", venueId)
    .single();
  const venueName = venue?.name || "Venue";
  const venueSlug = venue?.slug || "";

  const stripe = new Stripe(key, { apiVersion: "2026-02-25.clover" });
  const sandbox = isSandboxServer(h);

  // ─── Get or create Stripe customer ───────────────────────────
  let { data: wallet } = await supabase
    .from("user_wallets")
    .select("id, stripe_customer_id")
    .eq("user_id", user.id)
    .eq("mode", mode)
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
        mode,
      })
      .select("id, stripe_customer_id")
      .single();
    wallet = newWallet;
  }

  // Validate customer exists in current Stripe mode
  if (wallet?.stripe_customer_id) {
    try {
      await stripe.customers.retrieve(wallet.stripe_customer_id);
    } catch {
      wallet.stripe_customer_id = null as unknown as string;
    }
  }

  if (!wallet?.stripe_customer_id) {
    const customer = await stripe.customers.create({
      email: user.email || undefined,
      metadata: { user_id: user.id },
    });
    await supabase.from("user_wallets").update({ stripe_customer_id: customer.id }).eq("id", wallet!.id);
    wallet!.stripe_customer_id = customer.id;
  }

  // ─── Ensure Stripe Price exists ──────────────────────────────
  let stripePriceId = offering.stripe_price_id;

  if (!stripePriceId) {
    // Create product + price
    const product = await stripe.products.create({
      name: `${venueName} — ${offering.name}`,
      metadata: { venue_id: venueId, offering_id: offeringId },
    });

    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: offering.price_cents,
      currency: "usd",
      recurring: {
        interval: (offering.interval === "year" ? "year" : "month") as "month" | "year",
      },
    });

    stripePriceId = price.id;

    // Save back to offering
    await supabase
      .from("venue_offerings")
      .update({ stripe_price_id: price.id })
      .eq("id", offeringId);
  }

  // ─── Create Checkout Session ─────────────────────────────────
  const baseUrl = sandbox
    ? "https://sandbox.thekickback.net"
    : (process.env.NEXT_PUBLIC_APP_URL || "https://join.thekickback.net");

  // Get venue's connected Stripe account for payment routing
  const stripeAccountId = (venueStripe as Record<string, unknown>)[accountCol] as string;
  const feeRate = 0.10; // 10% platform fee

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: wallet!.stripe_customer_id,
      line_items: [{ price: stripePriceId, quantity: 1 }],
      success_url: `${baseUrl}/membership/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/${venueSlug}`,
      metadata: {
        user_id: user.id,
        venue_id: venueId,
        offering_id: offeringId,
      },
      subscription_data: {
        metadata: {
          user_id: user.id,
          venue_id: venueId,
          offering_id: offeringId,
        },
        application_fee_percent: feeRate * 100, // 10% to theKickBack
        transfer_data: {
          destination: stripeAccountId, // Remaining 90% goes to the place
        },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[membership/checkout] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
