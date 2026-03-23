import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

// ─── AI-powered category classification ─────────────────────────────
// Sends a batch of POS items to an LLM for accurate type classification.
// Falls back to keyword matching if AI is unavailable.

const VALID_TYPES = ["product", "service", "event", "reservation", "membership", "package"];

async function classifyOfferingsBatch(
  items: { id: string; name: string; description?: string; product_type?: string; category?: string }[],
  venueType?: string
): Promise<Record<string, string>> {
  if (items.length === 0) return {};

  const itemList = items.map((item, i) =>
    `${i + 1}. "${item.name}" — ${item.description || "no description"} (POS category: ${item.category || item.product_type || "none"})`
  ).join("\n");

  const prompt = `You are classifying menu/catalog items from a POS system for a ${venueType || "venue"}.

For each item, assign exactly ONE type from: product, service, event, reservation, membership, package

Guidelines:
- product: food, drinks, merchandise, physical goods
- service: haircuts, massages, lessons, classes, consultations, repairs
- event: tickets, shows, concerts, workshops, admission, live performances
- reservation: table bookings, room rentals, booth holds, space rentals
- membership: subscriptions, monthly passes, VIP access, recurring plans
- package: bundles, combos, deals, multi-item sets

Items:
${itemList}

Respond with ONLY a JSON object mapping item number to type, like: {"1":"product","2":"service","3":"event"}`;

  try {
    const gatewayUrl = process.env.OPENCLAW_GATEWAY_URL;
    const gatewayToken = process.env.OPENCLAW_GATEWAY_TOKEN;

    if (!gatewayUrl || !gatewayToken) throw new Error("No AI gateway configured");

    const res = await fetch(`${gatewayUrl}/v1/responses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${gatewayToken}`,
        "Content-Type": "application/json",
        "x-openclaw-agent-id": "pos-classifier",
      },
      body: JSON.stringify({
        model: "openrouter/anthropic/claude-haiku-4-5-20251001",
        input: prompt,
      }),
    });

    if (!res.ok) throw new Error(`AI returned ${res.status}`);

    const data = await res.json();
    const text = typeof data === "string" ? data : data.output_text || data.output || JSON.stringify(data);

    // Extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in AI response");

    const classifications = JSON.parse(jsonMatch[0]) as Record<string, string>;

    // Map back to item IDs
    const result: Record<string, string> = {};
    items.forEach((item, i) => {
      const type = classifications[String(i + 1)]?.toLowerCase();
      result[item.id] = VALID_TYPES.includes(type || "") ? type! : "product";
    });
    return result;
  } catch (err) {
    console.error("[pos/sync] AI classification failed, using fallback:", err);
    return fallbackClassify(items);
  }
}

// Keyword fallback if AI is down
function fallbackClassify(items: { id: string; name: string; description?: string }[]): Record<string, string> {
  const keywords: Record<string, string[]> = {
    service: ["haircut", "cut", "trim", "massage", "facial", "wax", "treatment", "consultation", "lesson", "class", "training", "repair", "cleaning"],
    event: ["event", "ticket", "admission", "entry", "cover", "show", "concert", "workshop", "party", "night", "festival"],
    reservation: ["reservation", "booking", "table", "room", "booth", "lane", "court", "rental"],
    membership: ["membership", "subscription", "member", "pass", "unlimited", "vip"],
    package: ["package", "bundle", "combo", "deal", "kit", "box"],
  };
  const result: Record<string, string> = {};
  for (const item of items) {
    const text = `${item.name} ${item.description || ""}`.toLowerCase();
    let type = "product";
    for (const [t, kws] of Object.entries(keywords)) {
      if (kws.some(kw => text.includes(kw))) { type = t; break; }
    }
    result[item.id] = type;
  }
  return result;
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

  // Get venue type for better AI classification context
  const { data: venueRow } = await service.from("venues").select("type").eq("id", venueId).single();
  const venueType = venueRow?.type || undefined;

  // Batch classify all items with AI
  const classifiableItems = items.map((item: Record<string, unknown>) => ({
    id: item.id as string,
    name: (item.name as string) || "Unnamed",
    description: item.description as string | undefined,
    product_type: item.product_type as string | undefined,
    category: item.category as string | undefined,
  }));
  const classifications = await classifyOfferingsBatch(classifiableItems, venueType);

  let added = 0;
  let updated = 0;
  const syncedPosItemIds: string[] = [];

  for (const item of items) {
    const posItemId = item.id;
    syncedPosItemIds.push(posItemId);

    const priceCents = item.price
      ? Math.round(parseFloat(item.price) * 100)
      : item.price_amount
        ? Math.round(item.price_amount * 100)
        : 0;

    const { data: existing } = await service
      .from("venue_offerings")
      .select("id")
      .eq("venue_id", venueId)
      .eq("pos_item_id", posItemId)
      .single();

    const offeringType = classifications[posItemId] || "product";
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
