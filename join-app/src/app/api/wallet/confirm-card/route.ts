import { NextRequest, NextResponse } from "next/server";
import { createClient as createAuthClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// POST /api/wallet/confirm-card — save payment method after SetupIntent succeeds
// Body: { paymentMethodId }
export async function POST(req: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Payments not configured" }, { status: 503 });
  }

  const authClient = await createAuthClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { paymentMethodId } = await req.json();
  if (!paymentMethodId) {
    return NextResponse.json({ error: "Missing paymentMethodId" }, { status: 400 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2026-02-25.clover" });

  // Get wallet
  const { data: wallet } = await supabase
    .from("user_wallets")
    .select("id, stripe_customer_id")
    .eq("user_id", user.id)
    .single();

  if (!wallet) {
    return NextResponse.json({ error: "No wallet found" }, { status: 404 });
  }

  try {
    // Retrieve payment method details
    const pm = await stripe.paymentMethods.retrieve(paymentMethodId);

    // Set as default payment method for the customer
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
