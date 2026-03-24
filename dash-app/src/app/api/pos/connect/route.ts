import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { venueId, cloverApiKey, cloverMerchantId } = await request.json();
  if (!venueId) {
    return Response.json({ error: "Missing venueId" }, { status: 400 });
  }
  if (!cloverApiKey || !cloverMerchantId) {
    return Response.json({ error: "Missing Clover API key or Merchant ID" }, { status: 400 });
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

  // Validate the Clover credentials by hitting their merchant endpoint
  const testRes = await fetch(
    `https://api.clover.com/v3/merchants/${cloverMerchantId}`,
    { headers: { Authorization: `Bearer ${cloverApiKey}` } },
  );

  if (!testRes.ok) {
    return Response.json(
      { error: "Invalid Clover credentials. Check your API key and Merchant ID." },
      { status: 400 },
    );
  }

  const service = createServiceClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );

  // Store Clover credentials and mark as connected
  await service
    .from("venues")
    .update({
      clover_api_key: cloverApiKey,
      clover_merchant_id: cloverMerchantId,
      pos_provider: "Clover",
      pos_connected_at: new Date().toISOString(),
    })
    .eq("id", venueId);

  return Response.json({ ok: true, provider: "Clover" });
}
