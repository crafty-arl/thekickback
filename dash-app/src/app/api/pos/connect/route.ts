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

  // Get venue name for consumer metadata
  const { data: venue } = await service
    .from("venues")
    .select("name")
    .eq("id", venueId)
    .single();

  // Store consumer ID on venue
  await service
    .from("venues")
    .update({ apideck_consumer_id: venueId })
    .eq("id", venueId);

  // Create Apideck Vault session
  const origin = request.headers.get("origin") || "https://dash.thekickback.net";

  const res = await fetch("https://unify.apideck.com/vault/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.APIDECK_API_KEY}`,
      "x-apideck-app-id": process.env.APIDECK_APP_ID!,
      "x-apideck-consumer-id": venueId,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      consumer_metadata: {
        account_name: venue?.name || "Venue",
      },
      redirect_uri: `${origin}/hub?pos=connected`,
      settings: {
        unified_apis: ["pos"],
        auto_redirect: true,
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.error("Apideck Vault session error:", res.status, errText);
    return Response.json({ error: "Failed to create POS connection session" }, { status: 500 });
  }

  const data = await res.json();
  return Response.json({ session_url: data.data?.session_url });
}
