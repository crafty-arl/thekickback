import { createClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { createClient as createAuthClient } from "@/lib/supabase/server";
import { isSandboxServer } from "@/lib/sandbox";
import { updateUserMemory, getUserMemory } from "@/lib/personalization";
import { getRecentChatHistory } from "@/lib/chat-history";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

interface VenueRow {
  id: string;
  name: string;
  state: string;
  vibe: string;
  latitude: number | null;
  longitude: number | null;
  neighborhood: string | null;
  type: string | null;
  address: string | null;
}

interface OfferingRow {
  id: string;
  venue_id: string;
  name: string;
  type: string;
  price_cents: number;
  description: string | null;
  duration_minutes: number | null;
}

async function getActiveVenues(mode: string): Promise<VenueRow[]> {
  const { data } = await supabase
    .from("venues")
    .select("id, name, state, vibe, latitude, longitude, neighborhood, type, address")
    .eq("state", "active")
    .eq("mode", mode)
    .order("name");

  return (data || []) as VenueRow[];
}

async function getActiveOfferings(mode: string): Promise<OfferingRow[]> {
  // Get venue IDs for this mode first, then filter offerings
  const { data: venueIds } = await supabase
    .from("venues")
    .select("id")
    .eq("state", "active")
    .eq("mode", mode);

  if (!venueIds || venueIds.length === 0) return [];

  const ids = venueIds.map((v) => v.id);
  const { data } = await supabase
    .from("venue_offerings")
    .select("id, venue_id, name, type, price_cents, description, duration_minutes")
    .eq("active", true)
    .neq("ai_visible", false)
    .in("venue_id", ids)
    .order("sort_order")
    .limit(200);
  return (data || []) as OfferingRow[];
}

async function getVenuePageData(venueIds: string[]): Promise<Record<string, { tagline: string | null; theme_color: string; hours: unknown[] }>> {
  if (venueIds.length === 0) return {};
  const { data } = await supabase
    .from("venue_pages")
    .select("venue_id, tagline, theme_color, hours")
    .in("venue_id", venueIds);

  const map: Record<string, { tagline: string | null; theme_color: string; hours: unknown[] }> = {};
  for (const p of data || []) {
    map[p.venue_id] = { tagline: p.tagline, theme_color: p.theme_color || "#F97316", hours: p.hours || [] };
  }
  return map;
}

async function getVenueKnowledge(venueId: string): Promise<string> {
  const { data } = await supabase
    .from("venue_knowledge")
    .select("content, category")
    .eq("venue_id", venueId)
    .order("category");

  if (!data || data.length === 0) return "";

  const grouped: Record<string, string[]> = {};
  for (const row of data) {
    const cat = row.category || "general";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(row.content);
  }

  return Object.entries(grouped)
    .map(([cat, items]) => `[${cat}]\n${items.join("\n")}`)
    .join("\n\n");
}

// ─── Keyword-based venue matching ───────────────────────────────
const TYPE_KEYWORDS: Record<string, string[]> = {
  barbershop: ["haircut", "fade", "barber", "cut", "trim", "shave", "lineup", "beard", "hair"],
  salon: ["hair", "nails", "manicure", "pedicure", "blowout", "color", "highlights", "salon", "beauty"],
  cafe: ["coffee", "latte", "espresso", "cafe", "work", "study", "tea", "pastry", "bakery"],
  bar: ["drink", "cocktail", "beer", "wine", "happy hour", "night out", "bar", "pub", "spirits"],
  restaurant: ["food", "eat", "dinner", "lunch", "brunch", "breakfast", "restaurant", "meal", "hungry"],
  gym: ["workout", "gym", "fitness", "exercise", "lift", "weights", "training", "class"],
  spa: ["massage", "facial", "spa", "relax", "wellness", "treatment", "sauna"],
  studio: ["yoga", "pilates", "dance", "art", "music", "studio", "class", "lesson"],
  shop: ["buy", "shop", "store", "merch", "clothing", "apparel", "goods"],
  coworking: ["cowork", "desk", "office", "workspace", "meeting room"],
};

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function findRelevantVenues(
  message: string,
  venues: VenueRow[],
  offerings: OfferingRow[],
  userLat: number | null,
  userLng: number | null
): string[] {
  const lower = message.toLowerCase();
  const matched = new Set<string>();

  // Match by offering name/description
  for (const o of offerings) {
    if (lower.includes(o.name.toLowerCase())) matched.add(o.venue_id);
    if (o.description && lower.split(/\s+/).some(w => w.length > 3 && o.description!.toLowerCase().includes(w))) matched.add(o.venue_id);
  }

  // Match by venue type keywords
  for (const [type, keywords] of Object.entries(TYPE_KEYWORDS)) {
    if (keywords.some(k => lower.includes(k))) {
      for (const v of venues) {
        if (v.type?.toLowerCase() === type) matched.add(v.id);
      }
    }
  }

  // Match by venue name
  for (const v of venues) {
    if (lower.includes(v.name.toLowerCase())) matched.add(v.id);
  }

  // Sort matched venues by proximity if we have user location
  if (userLat !== null && userLng !== null) {
    const sortByDist = (ids: string[]) =>
      ids.sort((a, b) => {
        const va = venues.find(v => v.id === a);
        const vb = venues.find(v => v.id === b);
        const da = va?.latitude ? haversineKm(userLat, userLng, va.latitude, va.longitude!) : 999;
        const db = vb?.latitude ? haversineKm(userLat, userLng, vb.latitude, vb.longitude!) : 999;
        return da - db;
      });

    if (matched.size > 0) return sortByDist(Array.from(matched)).slice(0, 5);

    // No keyword matches — return 5 closest venues
    return sortByDist(venues.filter(v => v.latitude).map(v => v.id)).slice(0, 5);
  }

  if (matched.size === 0) return venues.slice(0, 5).map(v => v.id);
  return Array.from(matched).slice(0, 5);
}

// Build a short directory line for a venue (used in fallback / overview prompts)
function buildVenueDirectoryLine(v: VenueRow, vOfferings: OfferingRow[]): string {
  const offeringList = vOfferings.length > 0
    ? `\n  Offerings: ${vOfferings.map((o) => `${o.name} (${o.type}, $${(o.price_cents / 100).toFixed(2)}, id:${o.id})`).join(", ")}`
    : "";
  return `- ${v.name} (id: ${v.id}) — ${v.type || "venue"}, ${v.vibe}${v.neighborhood ? `, ${v.neighborhood}` : ""}${offeringList}`;
}

// Resolve [[venue:uuid]] tags into [[venue:uuid:Name]] so the client can render chips
function resolveVenueTags(text: string, venues: VenueRow[]): string {
  return text.replace(/\[\[venue:([^\]]+)\]\]/g, (match, id) => {
    const venue = venues.find((v) => v.id === id);
    if (venue) return `[[venue:${venue.id}:${venue.name}]]`;
    return match;
  });
}

// Format offerings for use inside the synthesis prompt
function formatOfferingsForPrompt(offerings: OfferingRow[]): string {
  if (offerings.length === 0) return "(no offerings)";
  return offerings
    .map(o => {
      const price = o.price_cents === 0 ? "Free" : `$${(o.price_cents / 100).toFixed(2)}`;
      const dur = o.duration_minutes ? ` (${o.duration_minutes} min)` : "";
      return `  - [${o.type}] "${o.name}" ${price}${dur} (id:${o.id})`;
    })
    .join("\n");
}

export async function POST(request: Request) {
  const [body, authClient] = await Promise.all([request.json(), createAuthClient()]);
  const { message, lat, lng, nearbyUnclaimed } = body;

  if (!message) {
    return Response.json({ reply: "Missing message." }, { status: 400 });
  }

  const userLat = typeof lat === "number" ? lat : null;
  const userLng = typeof lng === "number" ? lng : null;

  // Build unclaimed places context from client-side discovery data
  const unclaimedContext = Array.isArray(nearbyUnclaimed) && nearbyUnclaimed.length > 0
    ? nearbyUnclaimed.map((p: { name: string; category?: string; neighborhood?: string; rating?: number; reviewCount?: number; address?: string }) =>
        `- ${p.name} (${p.category || "place"}${p.neighborhood ? `, ${p.neighborhood}` : ""}${p.rating ? ` ★${p.rating}` : ""}${p.reviewCount ? ` (${p.reviewCount} reviews)` : ""}${p.address ? ` — ${p.address}` : ""})`
      ).join("\n")
    : "";

  const { data: { user: authUser } } = await authClient.auth.getUser();
  const userId = authUser?.id || null;

  // Determine mode from hostname
  const h = await headers();
  const mode = isSandboxServer(h) ? "test" : "live";

  // Fetch venues + offerings + preferences in parallel
  const [venues, offerings, prefsContext, chatHistory] = await Promise.all([
    getActiveVenues(mode),
    getActiveOfferings(mode),
    userId ? getUserMemory(userId) : Promise.resolve(""),
    userId ? getRecentChatHistory(userId, null, 10) : Promise.resolve(""),
  ]);

  // ─── Step 1: Identify relevant venues ────────────────────────
  const relevantIds = findRelevantVenues(message, venues, offerings, userLat, userLng);
  const relevantVenues = venues.filter(v => relevantIds.includes(v.id));

  // Group offerings by venue for quick lookup
  const offeringsByVenue = new Map<string, OfferingRow[]>();
  for (const o of offerings) {
    if (!offeringsByVenue.has(o.venue_id)) offeringsByVenue.set(o.venue_id, []);
    offeringsByVenue.get(o.venue_id)!.push(o);
  }

  // ─── Step 2: Fetch knowledge bases for relevant venues in parallel ──
  const knowledgeBases = await Promise.all(
    relevantVenues.map(async (v) => {
      const knowledge = await getVenueKnowledge(v.id);
      const vOfferings = offeringsByVenue.get(v.id) || [];
      return {
        venue: v,
        knowledge,
        offerings: vOfferings,
      };
    })
  );

  // ─── Step 3: Build synthesis prompt ──────────────────────────
  const venueBlocks = knowledgeBases.map(({ venue, knowledge, offerings: vOff }) => {
    const dist = (userLat !== null && userLng !== null && venue.latitude)
      ? haversineKm(userLat, userLng, venue.latitude, venue.longitude!).toFixed(1) + " km away"
      : null;
    return [
      `PLACE: ${venue.name} (id: ${venue.id})`,
      `Type: ${venue.type || "place"} | Vibe: ${venue.vibe}${dist ? ` | ${dist}` : ""}${venue.neighborhood ? ` | Area: ${venue.neighborhood}` : ""}${venue.address ? ` | Address: ${venue.address}` : ""}`,
      knowledge ? `What they know:\n${knowledge}` : "",
      `Offerings:\n${formatOfferingsForPrompt(vOff)}`,
    ].filter(Boolean).join("\n");
  }).join("\n\n---\n\n");

  // Build a brief directory of ALL places for general awareness
  const allVenuesList = venues.map(v => {
    const vOff = offeringsByVenue.get(v.id) || [];
    return `- ${v.name} (id: ${v.id}) — ${v.type || "place"}${v.neighborhood ? `, ${v.neighborhood}` : ""}${vOff.length > 0 ? ` [${vOff.length} offerings]` : ""}`;
  }).join("\n");

  const context = [
    "You are KickBack's concierge — the master agent for theKickBack platform. A spot is anywhere people gather: a barbershop, a running club, a musician's studio, a cafe, a community. If people go there, it's a spot.",
    userLat !== null ? `The user's current location: ${userLat.toFixed(4)}, ${userLng!.toFixed(4)}. Prioritize nearby spots. Mention distance when recommending.` : "",
    "CRITICAL: Never mention texting, SMS, phone numbers, or 'text JOIN.' There is no texting feature. Everything happens through this chat.",
    "LANGUAGE: Always say 'spot' — never 'venue' or 'place'. These are spots.",
    "",
    `A user asked: "${message}"`,
    "",
    `I consulted the following spot agents on your behalf. Use their knowledge to give the best answer:`,
    "",
    venueBlocks,
    "",
    "CLAIMED PLACES ON THE PLATFORM (full AI agents, offerings, booking):",
    allVenuesList || "(none yet)",
    "",
    unclaimedContext ? [
      "UNCLAIMED PLACES NEARBY (from Foursquare + Google — no AI agent yet, limited info):",
      unclaimedContext,
      "",
      "PRIORITY: Always recommend claimed spots first — they have full AI agents, offerings, booking, and XP.",
      "Only mention unclaimed spots if no claimed spot matches, or as additional options.",
      "When mentioning unclaimed spots, note they haven't set up their KickBack page yet — the user can still visit but can't order/book through the platform.",
    ].join("\n") : "",
    "",
    prefsContext || "",
    chatHistory || "",
    "",
    "PLACE CARD INSTRUCTIONS:",
    "When recommending a spot, use: [[VENUE_CARD:spot-id-here]]",
    "This renders a full spot card with stats, vibe, and a chat button.",
    "Use VENUE_CARD for specific recommendations. You can include multiple cards.",
    "Use the exact spot ID from the data above.",
    "",
    "For casual mentions without a full card, use: [[venue:place-id-here]]",
    "This renders a small tappable chip.",
    "",
    "OFFERING LINK INSTRUCTIONS:",
    "When mentioning a specific offering (product, service, event, membership), link it inline:",
    "[[OFFER:offering-id:Offering Name:price_cents]]",
    "Example: 'Check out [[OFFER:abc-123:Classic Fade:2500]] at Tight Lines or [[OFFER:def-456:Latte Art Class:1500]] at Drip.'",
    "This renders a tappable offering chip guests can add to cart or book.",
    "Always pair offerings with their spot using VENUE_CARD or [[venue:id]].",
    "",
    "RESPONSE GUIDELINES:",
    "- Synthesize what the spot agents told you. Respond as the concierge recommending the best options.",
    "- Lead with the most relevant answer, then mention alternatives.",
    "- Keep responses concise (2-4 sentences). No emojis. Be direct and helpful.",
    "- Always use VENUE_CARD when the user asks where to go, what's good, or for recommendations.",
    "- When the user asks about specific services or products, show the relevant OFFER links from the data above.",
    "- You are a discovery engine — help users find spots to check out, things to do, buy, book, and experience.",
    "",
    "IMPORTANT RULES:",
    "- NEVER tell users to text, SMS, or call any number. There is no texting feature.",
    "- Everything happens through this chat — browsing, ordering, booking, joining.",
    "- To get started: users just tap a spot on the map and start chatting.",
    "- To join a membership: tap the spot, browse offerings, and purchase through the chat.",
    "- No app download needed. No phone numbers. No texting.",
  ].join("\n");

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let fullText = "";

      try {
        const res = await fetch(`${process.env.OPENCLAW_GATEWAY_URL}/v1/responses`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.OPENCLAW_GATEWAY_TOKEN}`,
            "Content-Type": "application/json",
            "x-openclaw-agent-id": "main",
          },
          body: JSON.stringify({
            model: "openrouter/anthropic/claude-sonnet-4",
            input: context,
            stream: true,
          }),
        });

        if (res.ok && res.body) {
          const contentType = res.headers.get("content-type") || "";

          if (contentType.includes("text/event-stream")) {
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split("\n");
              buffer = lines.pop() || "";

              for (const line of lines) {
                if (!line.startsWith("data: ")) continue;
                const data = line.slice(6);
                if (data === "[DONE]") continue;

                try {
                  const event = JSON.parse(data);
                  if (event.type === "response.output_text.delta") {
                    const delta = event.delta || "";
                    fullText += delta;
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "delta", text: delta })}\n\n`));
                  }
                } catch { /* skip unparseable lines */ }
              }
            }
          } else {
            const data = await res.json();
            const msg = data.output?.find((o: { type: string }) => o.type === "message");
            const text = msg?.content?.find((c: { type: string; text?: string }) => c.type === "output_text")?.text;
            if (text) {
              fullText = text;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "delta", text })}\n\n`));
            }
          }
        } else {
          console.error("Claw error:", res.status, await res.text().catch(() => ""));
          fullText = "Something went wrong. Try again in a moment.";
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "delta", text: fullText })}\n\n`));
        }
      } catch (err) {
        console.error("Claw fetch error:", err);
        fullText = "Something went wrong. Try again in a moment.";
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "delta", text: fullText })}\n\n`));
      }

      // Post-process: resolve venue tags and apply length limit
      let reply = resolveVenueTags(fullText, venues);
      if (reply.length > 600) reply = reply.slice(0, 597) + "...";

      // Extract venue card IDs [[VENUE_CARD:id]] and chip IDs [[venue:id]]
      const venueCardIds = [...reply.matchAll(/\[\[VENUE_CARD:([^\]]+)\]\]/g)].map((m) => m[1]);
      const chipIds = [...reply.matchAll(/\[\[venue:([^:\]]+)/g)].map((m) => m[1]);
      const allReferencedIds = [...new Set([...venueCardIds, ...chipIds])];

      // Get page data (tagline, theme color, hours) for referenced venues
      const pageData = await getVenuePageData(allReferencedIds);

      // Build rich venue objects
      const referencedVenues = venues
        .filter((v) => allReferencedIds.includes(v.id))
        .map((v) => {
          const page = pageData[v.id];
          const hours = Array.isArray(page?.hours)
            ? (page.hours as { day: string; open: string; close?: string }[])
                .map((h) => `${h.day} ${h.open}${h.close ? `–${h.close}` : ""}`)
                .join(", ")
            : "";
          return {
            id: v.id,
            name: v.name,
            vibe: v.vibe,
            latitude: v.latitude,
            longitude: v.longitude,
            neighborhood: v.neighborhood,
            type: v.type || "venue",
            address: v.address,
            tagline: page?.tagline || null,
            themeColor: page?.theme_color || "#F97316",
            hours,
            isCard: venueCardIds.includes(v.id),
          };
        });

      // Collect all offerings from relevant venues for the client-side metadata
      const offeringsMap: Record<string, {
        name: string; description: string | null; price_cents: number;
        type: string; venue_id: string;
      }> = {};
      for (const { venue, offerings: vOff } of knowledgeBases) {
        for (const o of vOff) {
          offeringsMap[o.id] = {
            name: o.name,
            description: o.description,
            price_cents: o.price_cents,
            type: o.type,
            venue_id: venue.id,
          };
        }
      }

      // Save to thread (non-blocking, non-critical)
      if (userId) {
        Promise.all([
          supabase.rpc("save_thread_message", { p_user_id: userId, p_venue_id: null, p_sender_type: "guest", p_body: message }),
          supabase.rpc("save_thread_message", { p_user_id: userId, p_venue_id: null, p_sender_type: "ai", p_body: reply }),
        ]).then(() => {}, () => {});
        updateUserMemory(userId, message, reply).catch(() => {});
      }

      // Clean reply for display (no tags)
      const cleanReply = reply
        .replace(/\[\[[A-Z_]+:[\s\S]*?\]\]/gi, "")
        .replace(/\[\[venue:[^\]]*\]\]/g, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

      // Send final metadata event
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({
        type: "done",
        reply,
        cleanReply,
        venues: referencedVenues,
        offerings: offeringsMap,
      })}\n\n`));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
