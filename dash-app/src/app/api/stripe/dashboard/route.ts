import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import Stripe from "stripe";

export const dynamic = "force-dynamic";

// GET /api/stripe/dashboard — get a Stripe dashboard login link
export async function GET() {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: ownership } = await supabase
    .from("venue_owners")
    .select("venue_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!ownership) return NextResponse.json({ error: "No venue" }, { status: 404 });

  const service = createServiceClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
  const { data: venue } = await service.from("venues").select("stripe_account_id").eq("id", ownership.venue_id).single();

  if (!venue?.stripe_account_id) {
    return NextResponse.json({ error: "Stripe not connected" }, { status: 400 });
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2026-02-25.clover" });
    const loginLink = await stripe.accounts.createLoginLink(venue.stripe_account_id);
    return NextResponse.json({ url: loginLink.url });
  } catch (err) {
    console.error("Stripe dashboard link error:", err);
    return NextResponse.json({ error: "Failed to create dashboard link" }, { status: 500 });
  }
}
