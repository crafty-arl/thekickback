import { headers } from "next/headers";
import { createClient as createAuthClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { isSandboxServer } from "@/lib/sandbox";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function POST(request: Request) {
  // Verify authenticated user from session cookie
  const authClient = await createAuthClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const h = await headers();
  const mode = isSandboxServer(h) ? "test" : "live";

  const userId = user.id;
  const { venueId, items, addOns, pointsToSpend, notes } = await request.json();

  if (!venueId || !items || items.length === 0) {
    return Response.json({ error: "Missing venue or items" }, { status: 400 });
  }

  // Merge add-ons into items array
  const allItems = [
    ...items,
    ...(addOns || []).map((a: { name: string; price_cents: number; offering_id?: string }) => ({
      offering_id: a.offering_id || null,
      slot_id: null,
      name: a.name,
      description: "Add-on",
      quantity: 1,
      unit_price_cents: a.price_cents,
      metadata: {},
    })),
  ];

  try {
    const { data, error } = await supabase.rpc("create_order", {
      p_user_id: userId,
      p_venue_id: venueId,
      p_items: allItems,
      p_points_to_spend: pointsToSpend || 0,
      p_notes: notes || null,
    });

    if (error) {
      console.error("Order error:", error);
      return Response.json({ error: error.message }, { status: 400 });
    }

    // Tag the order and its items with the current mode
    if (data) {
      await supabase.from("orders").update({ mode }).eq("id", data);
      await supabase.from("order_items").update({ mode }).eq("order_id", data);
    }

    // Grant purchase bonus points (10 pts per dollar spent)
    const totalCents = allItems.reduce(
      (sum: number, i: { unit_price_cents: number; quantity: number }) =>
        sum + i.unit_price_cents * (i.quantity || 1),
      0
    );
    const bonusPoints = Math.floor(totalCents / 10); // 10 pts per dollar

    if (bonusPoints > 0) {
      await supabase.rpc("grant_points", {
        p_user_id: userId,
        p_venue_id: venueId,
        p_amount: bonusPoints,
        p_reason: "purchase_bonus",
        p_reference_id: data,
      });
    }

    return Response.json({ orderId: data });
  } catch (err) {
    console.error("Order creation failed:", err);
    return Response.json({ error: "Failed to create order" }, { status: 500 });
  }
}
