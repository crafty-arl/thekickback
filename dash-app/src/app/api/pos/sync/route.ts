import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

// ─── AI-powered category classification ─────────────────────────────

const VALID_TYPES = ["product", "service", "event", "reservation", "membership", "package"];

async function classifyOfferingsBatch(
  items: { id: string; name: string; description?: string; category?: string }[],
  venueType?: string
): Promise<Record<string, string>> {
  if (items.length === 0) return {};

  const itemList = items.map((item, i) =>
    `${i + 1}. "${item.name}" — ${item.description || "no description"} (category: ${item.category || "none"})`
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

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in AI response");

    const classifications = JSON.parse(jsonMatch[0]) as Record<string, string>;

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

// ─── Clover API helpers ─────────────────────────────────────────────

interface CloverItem {
  id: string;
  name: string;
  price: number;
  priceType?: string;
  hidden?: boolean;
  categories?: { elements?: { id: string; name: string }[] };
}

async function fetchCloverItems(apiKey: string, merchantId: string): Promise<CloverItem[]> {
  const allItems: CloverItem[] = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const res = await fetch(
      `https://api.clover.com/v3/merchants/${merchantId}/items?expand=categories&limit=${limit}&offset=${offset}`,
      { headers: { Authorization: `Bearer ${apiKey}` } },
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Clover API error ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const items: CloverItem[] = data.elements || [];
    allItems.push(...items);

    if (items.length < limit) break;
    offset += limit;
  }

  return allItems.filter((item) => !item.hidden);
}

// ─── Route ──────────────────────────────────────────────────────────

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

  // Get venue's Clover credentials
  const { data: venue } = await service
    .from("venues")
    .select("clover_api_key, clover_merchant_id, type")
    .eq("id", venueId)
    .single();

  if (!venue?.clover_api_key || !venue?.clover_merchant_id) {
    return Response.json({ error: "Clover not connected. Add your API key in settings." }, { status: 400 });
  }

  // Fetch items from Clover
  let items: CloverItem[];
  try {
    items = await fetchCloverItems(venue.clover_api_key, venue.clover_merchant_id);
  } catch (err) {
    console.error("[pos/sync] Clover fetch error:", err);
    return Response.json({ error: "Failed to fetch items from Clover. Check your API key." }, { status: 500 });
  }

  // Batch classify all items with AI
  const classifiableItems = items.map((item) => ({
    id: item.id,
    name: item.name || "Unnamed",
    description: undefined as string | undefined,
    category: item.categories?.elements?.[0]?.name || undefined,
  }));
  const classifications = await classifyOfferingsBatch(classifiableItems, venue.type || undefined);

  let added = 0;
  let updated = 0;
  const syncedPosItemIds: string[] = [];

  for (const item of items) {
    const posItemId = item.id;
    syncedPosItemIds.push(posItemId);

    // Clover prices are in cents already
    const priceCents = item.price || 0;

    const { data: existing } = await service
      .from("venue_offerings")
      .select("id")
      .eq("venue_id", venueId)
      .eq("pos_item_id", posItemId)
      .single();

    const offeringType = classifications[posItemId] || "product";
    const category = item.categories?.elements?.[0]?.name || null;

    if (existing) {
      await service
        .from("venue_offerings")
        .update({
          name: item.name || "Unnamed Item",
          price_cents: priceCents,
          type: offeringType,
          category,
          pos_provider: "Clover",
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
          price_cents: priceCents,
          type: offeringType,
          category,
          pos_provider: "Clover",
          pos_item_id: posItemId,
          ai_visible: true,
          synced_at: new Date().toISOString(),
          active: true,
          sort_order: 999,
        });
      added++;
    }
  }

  // Mark previously synced items no longer in catalog as inactive
  if (syncedPosItemIds.length > 0) {
    await service
      .from("venue_offerings")
      .update({ active: false })
      .eq("venue_id", venueId)
      .eq("pos_provider", "Clover")
      .not("pos_item_id", "in", `(${syncedPosItemIds.map((id) => `"${id}"`).join(",")})`);
  } else {
    await service
      .from("venue_offerings")
      .update({ active: false })
      .eq("venue_id", venueId)
      .not("pos_provider", "is", null);
  }

  // Update venue POS connection timestamp
  await service
    .from("venues")
    .update({ pos_connected_at: new Date().toISOString() })
    .eq("id", venueId);

  return Response.json({ synced: items.length, added, updated });
}
