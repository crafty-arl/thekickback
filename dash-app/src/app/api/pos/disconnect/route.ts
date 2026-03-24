import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { venueId } = await request.json();
  if (!venueId) {
    return Response.json({ error: "Missing venueId" }, { status: 400 });
  }

  // Verify ownership
  const { data: ownership } = await supabase
    .from("venue_owners")
    .select("venue_id")
    .eq("user_id", user.id)
    .eq("venue_id", venueId)
    .single();

  if (!ownership) {
    return Response.json({ error: "Not your venue" }, { status: 403 });
  }

  const service = createServiceClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );

  // Remove POS connection from venue
  await service
    .from("venues")
    .update({
      pos_provider: null,
      pos_connected_at: null,
      clover_api_key: null,
      clover_merchant_id: null,
    })
    .eq("id", venueId);

  // Deactivate all POS-synced offerings
  await service
    .from("venue_offerings")
    .update({ active: false })
    .eq("venue_id", venueId)
    .not("pos_provider", "is", null);

  return Response.json({ ok: true });
}
