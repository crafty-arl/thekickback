import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

export const dynamic = "force-dynamic";

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
}

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY || process.env.STRIPE_TEST_SECRET_KEY || "");
}

// POST /api/membership/webhook — Stripe webhook for subscription lifecycle
export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";

  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[membership/webhook] Signature verification failed:", message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case "invoice.payment_succeeded":
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case "invoice.payment_failed":
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        console.log("[membership/webhook] Unhandled event:", event.type);
    }
  } catch (err) {
    console.error("[membership/webhook] Handler error:", err);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

// ─── checkout.session.completed ────────────────────────────────
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.user_id;
  const venueId = session.metadata?.venue_id;
  const offeringId = session.metadata?.offering_id;

  if (!userId || !venueId || !offeringId) {
    console.error("[membership/webhook] Missing metadata on checkout session:", session.id);
    return;
  }

  // Retrieve the subscription
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sess = session as any;
  const subscriptionId = typeof sess.subscription === "string" ? sess.subscription : sess.subscription?.id;

  if (!subscriptionId) {
    console.error("[membership/webhook] No subscription on checkout session:", session.id);
    return;
  }

  const sub = await getStripe().subscriptions.retrieve(subscriptionId) as any;
  const expiresAt = new Date(sub.current_period_end * 1000).toISOString();

  const { error } = await getSupabase().from("memberships").upsert({
    user_id: userId,
    venue_id: venueId,
    offering_id: offeringId,
    tier: "member",
    expires_at: expiresAt,
    stripe_subscription_id: subscriptionId,
    auto_renew: true,
    charge_method: "stripe",
    last_charged_at: new Date().toISOString(),
  }, { onConflict: "user_id,venue_id" });

  if (error) {
    console.error("[membership/webhook] Upsert membership failed:", error.message);
  } else {
    console.log("[membership/webhook] Membership created:", { userId, venueId, subscriptionId });
  }

  // Insert pending fulfillment for wallet pass
  const { data: offering } = await getSupabase()
    .from("venue_offerings")
    .select("name")
    .eq("id", offeringId)
    .single();
  const { data: venue } = await getSupabase()
    .from("venues")
    .select("name")
    .eq("id", venueId)
    .single();

  await getSupabase().from("pending_fulfillments").insert({
    user_id: userId,
    venue_id: venueId,
    type: "order",
    reference_id: subscriptionId,
    label: `${offering?.name || "Membership"} @ ${venue?.name || "Venue"}`,
  });
}

// ─── customer.subscription.updated ─────────────────────────────
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sub = subscription as any;
  const expiresAt = new Date(sub.current_period_end * 1000).toISOString();
  const autoRenew = sub.cancel_at_period_end === false;

  const { error } = await getSupabase()
    .from("memberships")
    .update({ expires_at: expiresAt, auto_renew: autoRenew })
    .eq("stripe_subscription_id", subscription.id);

  if (error) {
    console.error("[membership/webhook] Update subscription failed:", error.message);
  }
}

// ─── customer.subscription.deleted ─────────────────────────────
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const { error } = await getSupabase()
    .from("memberships")
    .update({
      expires_at: new Date().toISOString(),
      auto_renew: false,
    })
    .eq("stripe_subscription_id", subscription.id);

  if (error) {
    console.error("[membership/webhook] Delete subscription failed:", error.message);
  } else {
    console.log("[membership/webhook] Membership expired:", subscription.id);
  }
}

// ─── invoice.payment_succeeded ─────────────────────────────────
async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inv = invoice as any;
  const subscriptionId = typeof inv.subscription === "string" ? inv.subscription : inv.subscription?.id;
  if (!subscriptionId) return;

  const sub = await getStripe().subscriptions.retrieve(subscriptionId) as any;
  const expiresAt = new Date(sub.current_period_end * 1000).toISOString();

  const { error } = await getSupabase()
    .from("memberships")
    .update({
      expires_at: expiresAt,
      last_charged_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscriptionId);

  if (error) {
    console.error("[membership/webhook] Payment succeeded update failed:", error.message);
  }
}

// ─── invoice.payment_failed ────────────────────────────────────
async function handlePaymentFailed(invoice: Stripe.Invoice) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inv = invoice as any;
  const subscriptionId = typeof inv.subscription === "string" ? inv.subscription : inv.subscription?.id;

  if (!subscriptionId) return;

  // Find the membership to get user info
  const { data: membership } = await getSupabase()
    .from("memberships")
    .select("user_id, venue_id")
    .eq("stripe_subscription_id", subscriptionId)
    .single();

  if (!membership) return;

  console.error("[membership/webhook] Payment failed for subscription:", subscriptionId, "user:", membership.user_id);

  // Could add email notification here in the future
}
