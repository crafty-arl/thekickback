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

  // Auto-create test wallet if in sandbox mode and none exists
  if (mode === "test") {
    const { data: existing } = await supabase
      .from("user_wallets")
      .select("id")
      .eq("user_id", user.id)
      .eq("mode", "test")
      .eq("active", true)
      .maybeSingle();

    if (!existing) {
      await supabase.from("user_wallets").insert({
        user_id: user.id,
        balance_cents: 50000, // $500 test balance
        spending_limit_cents: 50000,
        spending_period: "daily",
        spent_this_period_cents: 0,
        active: true,
        mode: "test",
      });
    }
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

  // ─── Email 6: Low Wallet Balance (< $5 remaining) ─────────────
  if (user.email && result.balance_cents < 500) {
    try {
      const balanceDollars = (result.balance_cents / 100).toFixed(2);
      sendEmail(user.email, "Running low — theKickBack wallet", wrap(`
        <div style="text-align:center;margin-bottom:24px;">
          <div style="width:56px;height:56px;border-radius:50%;background:#FBBF24;margin:0 auto 12px;display:flex;align-items:center;justify-content:center;">
            <span style="font-size:28px;color:#000;line-height:56px;">&#9888;</span>
          </div>
          <h1 style="margin:0;font-size:24px;color:#fff;">Running low.</h1>
        </div>
        <div style="text-align:center;margin:20px 0;">
          <span style="font-size:48px;font-weight:800;color:#FBBF24;">$${balanceDollars}</span>
          <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.4);">remaining in your wallet</p>
        </div>
        <div style="text-align:center;margin-top:24px;">
          <a href="https://join.thekickback.net" style="display:inline-block;padding:12px 28px;background:#FBBF24;color:#000;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;">Add funds</a>
        </div>
      `));
    } catch (e) { console.error("Low balance email failed:", e); }
  }

  return NextResponse.json({
    ok: true,
    transactionId: result.transaction_id,
    balanceCents: result.balance_cents,
  });
}
