import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

// ─── Category mapping: POS data → our offering types ────────────────
// POS systems use varying category/type names. We normalize to our types:
// product, service, event, reservation, membership, package, custom

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  service: ["service", "haircut", "cut", "trim", "color", "styling", "massage", "facial", "manicure", "pedicure", "wax", "treatment", "consultation", "session", "lesson", "class", "training", "repair", "cleaning", "wash", "detail"],
  event: ["event", "ticket", "admission", "entry", "cover", "show", "concert", "performance", "workshop", "seminar", "party", "night", "festival", "meetup"],
  reservation: ["reservation", "booking", "table", "room", "space", "booth", "lane", "court", "rental", "hire"],
  membership: ["membership", "subscription", "member", "plan", "pass", "unlimited", "monthly", "annual", "vip"],
  package: ["package", "bundle", "combo", "deal", "set", "kit", "box"],
};

function classifyOffering(item: { name?: string; description?: string; product_type?: string; category?: string; type?: string }): string {
  // Check explicit POS type/category fields first
  const posType = (item.product_type || item.type || item.category || "").toLowerCase();
  if (posType.includes("service")) return "service";
  if (posType.includes("event") || posType.includes("ticket")) return "event";
  if (posType.includes("membership") || posType.includes("subscription")) return "membership";

  // Keyword match on name + description
  const text = `${item.name || ""} ${item.description || ""}`.toLowerCase();
  for (const [type, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(kw => text.includes(kw))) return type;
  }

  // Default: product (food, drink, merch, etc.)
  return "product";
}

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

  // Fetch POS items from Apideck
  const res = await fetch("https://unify.apideck.com/pos/items", {
    headers: {
      Authorization: `Bearer ${process.env.APIDECK_API_KEY}`,
      "x-apideck-app-id": process.env.APIDECK_APP_ID!,
      "x-apideck-consumer-id": venueId,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.error("Apideck POS items error:", res.status, errText);
    return Response.json({ error: "Failed to fetch POS catalog" }, { status: 500 });
  }

  const data = await res.json();
  const items = data.data || [];

  // Determine provider from the Apideck response metadata
  const posProvider = data.service?.name || data.service?.id || "pos";

  let added = 0;
  let updated = 0;
  const syncedPosItemIds: string[] = [];

  for (const item of items) {
    const posItemId = item.id;
    syncedPosItemIds.push(posItemId);

    // Resolve price: Apideck POS items may have price in various formats
    const priceCents = item.price
      ? Math.round(parseFloat(item.price) * 100)
      : item.price_amount
        ? Math.round(item.price_amount * 100)
        : 0;

    // Check if this POS item already exists for this venue
    const { data: existing } = await service
      .from("venue_offerings")
      .select("id")
      .eq("venue_id", venueId)
      .eq("pos_item_id", posItemId)
      .single();

    const offeringType = classifyOffering(item);
    const category = item.category || item.product_type || null;

    if (existing) {
      await service
        .from("venue_offerings")
        .update({
          name: item.name || "Unnamed Item",
          description: item.description || null,
          price_cents: priceCents,
          type: offeringType,
          category,
          pos_provider: posProvider,
          synced_at: new Date().toISOString(),
          active: true,
        })
        .eq("id", existing.id);
      updated++;
    } else {
      await service
        .from("venue_offerings")
        .insert({
          venue_id: venueId,
          name: item.name || "Unnamed Item",
          description: item.description || null,
          price_cents: priceCents,
          type: offeringType,
          category,
          pos_provider: posProvider,
          pos_item_id: posItemId,
          ai_visible: true,
          synced_at: new Date().toISOString(),
          active: true,
          sort_order: 999,
        });
      added++;
    }
  }

  // Mark offerings that were previously synced from this POS but no longer in the catalog as inactive
  if (syncedPosItemIds.length > 0) {
    await service
      .from("venue_offerings")
      .update({ active: false })
      .eq("venue_id", venueId)
      .eq("pos_provider", posProvider)
      .not("pos_item_id", "in", `(${syncedPosItemIds.map((id) => `"${id}"`).join(",")})`);
  } else {
    // If no items came back, deactivate all POS-synced offerings
    await service
      .from("venue_offerings")
      .update({ active: false })
      .eq("venue_id", venueId)
      .not("pos_provider", "is", null);
  }

  // Update venue POS connection state
  await service
    .from("venues")
    .update({
      pos_provider: posProvider,
      pos_connected_at: new Date().toISOString(),
    })
    .eq("id", venueId);

  return Response.json({
    synced: items.length,
    added,
    updated,
  });
}
