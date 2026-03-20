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

// POST /api/wallet/spend — spend from prepaid wallet balance
// Body: { amountCents, venueId, orderId?, description? }
// Money is already in the wallet — this just deducts and optionally transfers to venue
export async function POST(req: NextRequest) {
  const authClient = await createAuthClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const h = await headers();
  const mode = isSandboxServer(h) ? "test" : "live";

  const { amountCents, venueId, orderId, description } = await req.json();

  if (!amountCents || amountCents <= 0) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }
  if (!venueId) {
    return NextResponse.json({ error: "Missing venueId" }, { status: 400 });
  }

  // Deduct from wallet balance via atomic DB function
  const { data: result } = await supabase.rpc("wallet_spend", {
    p_user_id: user.id,
    p_amount_cents: amountCents,
    p_venue_id: venueId,
    p_order_id: orderId || null,
    p_description: description || null,
    p_mode: mode,
  });

  if (!result?.ok) {
    return NextResponse.json({
      error: result?.error || "Wallet spend failed",
      balanceCents: result?.balance_cents,
    }, { status: 400 });
  }

  // If venue has Stripe Connect, transfer their cut
  const { key: stripeKey } = getStripeSecretKey(h);
  if (stripeKey) {
    const accountCol = mode === "test" ? "stripe_test_account_id" : "stripe_account_id";
    const { data: venue } = await supabase
      .from("venues")
      .select(`${accountCol}, platform_fee_rate`)
      .eq("id", venueId)
      .single();

    const stripeAccountId = (venue as Record<string, unknown>)?.[accountCol] as string | undefined;
    if (stripeAccountId && result.stripe_customer_id) {
      try {
        const stripe = new Stripe(stripeKey, { apiVersion: "2026-02-25.clover" });
        const feeRate = (venue as Record<string, unknown>)?.platform_fee_rate as number || 0.10;
        const venueAmount = Math.round(amountCents * (1 - feeRate));

        // Transfer to venue's connected account
        const transfer = await stripe.transfers.create({
          amount: venueAmount,
          currency: "usd",
          destination: stripeAccountId,
          metadata: {
            user_id: user.id,
            venue_id: venueId,
            order_id: orderId || "",
            transaction_id: result.transaction_id,
          },
        });

        // Update transaction with transfer ID
        await supabase.from("wallet_transactions").update({
          stripe_transfer_id: transfer.id,
        }).eq("id", result.transaction_id);
      } catch (err) {
        // Transfer failed but wallet was already deducted — log but don't fail
        console.error("Venue transfer failed:", err instanceof Error ? err.message : err);
      }
    }
  }

  return NextResponse.json({
    ok: true,
    transactionId: result.transaction_id,
    balanceCents: result.balance_cents,
  });
}
