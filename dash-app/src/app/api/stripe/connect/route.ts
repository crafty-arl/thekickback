import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import Stripe from "stripe";

export const dynamic = "force-dynamic";

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
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const auth = await getAuthVenue();
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2025-04-30.basil" });
  const service = createServiceClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

  try {
    const { data: existing } = await service
      .from("venues")
      .select("stripe_account_id")
      .eq("id", auth.venueId)
      .single();

    let accountId = existing?.stripe_account_id;

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "standard",
        email: auth.email || undefined,
        metadata: { venue_id: auth.venueId, venue_name: auth.venueName },
      });
      accountId = account.id;
      await service.from("venues").update({ stripe_account_id: accountId }).eq("id", auth.venueId);
    }

    const accountLink = await stripe.accountLinks.create({
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
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ connected: false, error: "Stripe not configured" });
  }

  const auth = await getAuthVenue();
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2025-04-30.basil" });
  const service = createServiceClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

  const { data: venue } = await service.from("venues").select("stripe_account_id").eq("id", auth.venueId).single();

  if (!venue?.stripe_account_id) {
    return NextResponse.json({ connected: false });
  }

  try {
    const account = await stripe.accounts.retrieve(venue.stripe_account_id);
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
