import { createClient } from "@supabase/supabase-js";
import { createClient as createAuthClient } from "@/lib/supabase/server";

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

  const { orderId, status } = await request.json() as { orderId: string; status: string };

  if (!orderId || !status) {
    return Response.json({ error: "Missing orderId or status" }, { status: 400 });
  }

  const validStatuses = ["pending", "confirmed", "fulfilled", "cancelled"];
  if (!validStatuses.includes(status)) {
    return Response.json({ error: "Invalid status" }, { status: 400 });
  }

  // Verify this order belongs to the owner's venue
  const { data: order } = await service
    .from("orders")
    .select("id, venue_id")
    .eq("id", orderId)
    .single();

  if (!order || order.venue_id !== ownership.venue_id) {
    return Response.json({ error: "Order not found or not authorized" }, { status: 404 });
  }

  // Update order status
  const { error } = await service
    .from("orders")
    .update({ status })
    .eq("id", orderId);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
