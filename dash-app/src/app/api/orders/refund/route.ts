import { createClient } from "@supabase/supabase-js";
import { createClient as createAuthClient } from "@/lib/supabase/server";
import { isSandbox } from "@/lib/stripe";

export async function POST(request: Request) {
  // Auth check
  const authClient = await createAuthClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const service = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );

  // Get venue ownership
  const { data: ownership } = await service
    .from("venue_owners")
    .select("venue_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!ownership || ownership.role !== "owner") {
    return Response.json({ error: "Not authorized" }, { status: 403 });
  }

  const { orderId, reason } = await request.json() as { orderId: string; reason?: string };

  if (!orderId) {
    return Response.json({ error: "Missing orderId" }, { status: 400 });
  }

  // Verify this order belongs to the owner's venue and fetch details
  const { data: order } = await service
    .from("orders")
    .select("id, venue_id, user_id, total_cents, status, mode")
    .eq("id", orderId)
    .single();

  if (!order || order.venue_id !== ownership.venue_id) {
    return Response.json({ error: "Order not found or not authorized" }, { status: 404 });
  }

  if (order.status === "refunded" || order.status === "cancelled") {
    return Response.json({ error: `Order is already ${order.status}` }, { status: 400 });
  }

  const mode = order.mode || (await isSandbox() ? "test" : "live");

  // Update order status to refunded
  const { error: updateErr } = await service
    .from("orders")
    .update({ status: "refunded" })
    .eq("id", orderId);

  if (updateErr) {
    return Response.json({ error: updateErr.message }, { status: 500 });
  }

  // Credit the customer's wallet if we have a user_id
  if (order.user_id && order.total_cents > 0) {
    // Find or create the customer's wallet
    const { data: wallet } = await service
      .from("user_wallets")
      .select("id, balance_cents")
      .eq("user_id", order.user_id)
      .eq("mode", mode)
      .eq("active", true)
      .maybeSingle();

    if (wallet) {
      // Increase wallet balance
      await service
        .from("user_wallets")
        .update({ balance_cents: wallet.balance_cents + order.total_cents })
        .eq("id", wallet.id);

      // Insert refund transaction record
      await service.from("wallet_transactions").insert({
        user_id: order.user_id,
        amount_cents: order.total_cents,
        description: reason ? `Refund: ${reason}` : "Order refund",
        status: "completed",
        venue_id: order.venue_id,
        mode,
      });
    }
  }

  return Response.json({ ok: true });
}
