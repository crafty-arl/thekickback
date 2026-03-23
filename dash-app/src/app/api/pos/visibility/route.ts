import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { offeringId, ai_visible } = await request.json();
  if (!offeringId || typeof ai_visible !== "boolean") {
    return Response.json({ error: "Missing offeringId or ai_visible" }, { status: 400 });
  }

  const service = createServiceClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );

  // Verify offering belongs to a venue this user owns
  const { data: offering } = await service
    .from("venue_offerings")
    .select("venue_id")
    .eq("id", offeringId)
    .single();

  if (!offering) {
    return Response.json({ error: "Offering not found" }, { status: 404 });
  }

  const { data: ownership } = await supabase
    .from("venue_owners")
    .select("venue_id")
    .eq("user_id", user.id)
    .eq("venue_id", offering.venue_id)
    .single();

  if (!ownership) {
    return Response.json({ error: "Not your venue" }, { status: 403 });
  }

  await service
    .from("venue_offerings")
    .update({ ai_visible })
    .eq("id", offeringId);

  return Response.json({ ok: true });
}
