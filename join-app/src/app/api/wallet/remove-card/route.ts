import { NextResponse } from "next/server";
import { createClient as createAuthClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// POST /api/wallet/remove-card — detach payment method from wallet
export async function POST() {
  const authClient = await createAuthClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: wallet } = await supabase
    .from("user_wallets")
    .select("id, stripe_customer_id, stripe_payment_method_id")
    .eq("user_id", user.id)
    .single();

  if (!wallet) {
    return NextResponse.json({ error: "No wallet found" }, { status: 404 });
  }

  // Detach from Stripe if possible
  if (wallet.stripe_payment_method_id && process.env.STRIPE_SECRET_KEY) {
    try {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2026-02-25.clover" });
      await stripe.paymentMethods.detach(wallet.stripe_payment_method_id);
    } catch {
      // Payment method may already be detached — continue
    }
  }

  // Clear card from wallet
  await supabase.from("user_wallets").update({
    stripe_payment_method_id: null,
    card_last4: null,
    card_brand: null,
    updated_at: new Date().toISOString(),
  }).eq("id", wallet.id);

  return NextResponse.json({ ok: true });
}
