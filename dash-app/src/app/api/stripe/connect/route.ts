"use server";

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import Stripe from "stripe";

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2026-02-25.clover",
  });
}

const service = createServiceClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function getAuthVenue() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: ownership } = await supabase
    .from("venue_owners")
    .select("venue_id, role, venues(id, name)")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!ownership) return null;
  const venue = ownership.venues as unknown as { id: string; name: string };
  return { userId: user.id, email: user.email, venueId: venue.id, venueName: venue.name };
}

// POST /api/stripe/connect — create Stripe Connect onboarding link
export async function POST() {
  const auth = await getAuthVenue();
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  try {
    // Check if venue already has a Stripe account
    const { data: existing } = await service
      .from("venues")
      .select("stripe_account_id")
      .eq("id", auth.venueId)
      .single();

    let accountId = existing?.stripe_account_id;

    if (!accountId) {
      // Create a new Stripe Connect account (Standard type)
      const account = await getStripe().accounts.create({
        type: "standard",
        email: auth.email || undefined,
        metadata: {
          venue_id: auth.venueId,
          venue_name: auth.venueName,
        },
      });

      accountId = account.id;

      // Save to venue
      await service
        .from("venues")
        .update({ stripe_account_id: accountId })
        .eq("id", auth.venueId);
    }

    // Create an account link for onboarding
    const accountLink = await getStripe().accountLinks.create({
      account: accountId,
      refresh_url: `${process.env.NEXT_PUBLIC_APP_URL || "https://dash.thekickback.net"}/settings?stripe=refresh`,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL || "https://dash.thekickback.net"}/settings?stripe=success`,
      type: "account_onboarding",
    });

    return NextResponse.json({ url: accountLink.url });
  } catch (err) {
    console.error("Stripe Connect error:", err);
    return NextResponse.json({ error: "Failed to create Stripe connection" }, { status: 500 });
  }
}

// GET /api/stripe/connect — check Stripe connection status
export async function GET() {
  const auth = await getAuthVenue();
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: venue } = await service
    .from("venues")
    .select("stripe_account_id")
    .eq("id", auth.venueId)
    .single();

  if (!venue?.stripe_account_id) {
    return NextResponse.json({ connected: false });
  }

  try {
    const account = await getStripe().accounts.retrieve(venue.stripe_account_id);

    return NextResponse.json({
      connected: true,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
      accountId: account.id,
      email: account.email,
    });
  } catch {
    return NextResponse.json({ connected: false, error: "Account not found" });
  }
}
