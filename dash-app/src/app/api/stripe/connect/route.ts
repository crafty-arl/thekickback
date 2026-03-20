import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { getStripeKey, isSandbox } from "@/lib/stripe";

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
  const { key, testMode } = await getStripeKey();
  if (!key) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const auth = await getAuthVenue();
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const stripe = new Stripe(key, { apiVersion: "2026-02-25.clover" });
  const service = createServiceClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

  try {
    const sandbox = await isSandbox();
    const accountCol = sandbox ? "stripe_test_account_id" : "stripe_account_id";

    const { data: existing, error: queryError } = await service
      .from("venues")
      .select("stripe_account_id, stripe_test_account_id")
      .eq("id", auth.venueId)
      .single();

    if (queryError) {
      console.error("Stripe Connect: venue query error:", queryError.message, queryError.code);
      return NextResponse.json({ error: `Database error: ${queryError.message}` }, { status: 500 });
    }

    let accountId = (existing as Record<string, unknown>)?.[accountCol] as string | null;

    // If existing account is from the wrong mode (test vs live), clear it
    if (accountId) {
      try {
        await stripe.accounts.retrieve(accountId);
      } catch {
        console.log(`Stripe Connect: clearing stale account ${accountId} (wrong mode)`);
        await service.from("venues").update({ [accountCol]: null }).eq("id", auth.venueId);
        accountId = null;
      }
    }

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "standard",
        email: auth.email || undefined,
        metadata: { venue_id: auth.venueId, venue_name: auth.venueName },
      });
      accountId = account.id;

      const { error: updateError } = await service.from("venues").update({ [accountCol]: accountId }).eq("id", auth.venueId);
      if (updateError) {
        console.error("Stripe Connect: failed to save account ID:", updateError.message);
      }
    }

    const baseUrl = testMode
      ? (process.env.NEXT_PUBLIC_SANDBOX_URL || "https://sanddash.thekickback.net")
      : (process.env.NEXT_PUBLIC_APP_URL || "https://dash.thekickback.net");

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${baseUrl}/settings?stripe=refresh`,
      return_url: `${baseUrl}/settings?stripe=success`,
      type: "account_onboarding",
    });

    return NextResponse.json({ url: accountLink.url, testMode });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Stripe Connect error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET /api/stripe/connect — check Stripe connection status
export async function GET() {
  const { key, testMode } = await getStripeKey();
  if (!key) {
    return NextResponse.json({ connected: false, testMode, error: "Stripe not configured" });
  }

  const auth = await getAuthVenue();
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const stripe = new Stripe(key, { apiVersion: "2026-02-25.clover" });
  const service = createServiceClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

  const sandbox = await isSandbox();
  const accountCol = sandbox ? "stripe_test_account_id" : "stripe_account_id";

  const { data: venue } = await service.from("venues").select("stripe_account_id, stripe_test_account_id").eq("id", auth.venueId).single();

  const stripeAccountId = (venue as Record<string, unknown>)?.[accountCol] as string | null;
  if (!stripeAccountId) {
    return NextResponse.json({ connected: false, testMode });
  }

  try {
    const account = await stripe.accounts.retrieve(stripeAccountId);
    return NextResponse.json({
      connected: true,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
      accountId: account.id,
      email: account.email,
      testMode,
    });
  } catch {
    await service.from("venues").update({ [accountCol]: null }).eq("id", auth.venueId);
    return NextResponse.json({ connected: false, testMode, error: "Account not found — please reconnect" });
  }
}
