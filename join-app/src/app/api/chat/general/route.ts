import { createClient } from "@supabase/supabase-js";
import { createClient as createAuthClient } from "@/lib/supabase/server";
import { extractPreferences, getPreferencesContext } from "@/lib/personalization";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

interface VenueRow {
  id: string;
  name: string;
  state: string;
  vibe: string;
  occupancy: number;
  max_occupancy: number;
  latitude: number | null;
  longitude: number | null;
  neighborhood: string | null;
  type: string | null;
  address: string | null;
}

async function getActiveVenues(): Promise<VenueRow[]> {
  const { data } = await supabase
    .from("venues")
    .select("id, name, state, vibe, occupancy, max_occupancy, latitude, longitude, neighborhood, type, address")
    .eq("state", "active")
    .order("name");

  return (data || []) as VenueRow[];
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

interface OfferingRow {
  id: string;
  venue_id: string;
  name: string;
  type: string;
  price_cents: number;
  description: string | null;
  duration_minutes: number | null;
}

async function getActiveOfferings(): Promise<OfferingRow[]> {
  const { data } = await supabase
    .from("venue_offerings")
    .select("id, venue_id, name, type, price_cents, description, duration_minutes")
    .eq("active", true)
    .order("sort_order")
    .limit(200);
  return (data || []) as OfferingRow[];
}

function buildVenueDirectory(venues: VenueRow[], offerings: OfferingRow[]): string {
  if (venues.length === 0) return "No venues currently active.";

  // Group offerings by venue
  const offeringsByVenue = new Map<string, OfferingRow[]>();
  for (const o of offerings) {
    if (!offeringsByVenue.has(o.venue_id)) offeringsByVenue.set(o.venue_id, []);
    offeringsByVenue.get(o.venue_id)!.push(o);
  }

  return venues.map((v) => {
    const vOfferings = offeringsByVenue.get(v.id) || [];
    const offeringList = vOfferings.length > 0
      ? `\n  Offerings: ${vOfferings.map((o) => `${o.name} (${o.type}, $${(o.price_cents / 100).toFixed(2)}, id:${o.id})`).join(", ")}`
      : "";
    return `- ${v.name} (id: ${v.id}) — ${v.type || "venue"}, ${v.vibe}, ${v.occupancy}/${v.max_occupancy} people${v.neighborhood ? `, ${v.neighborhood}` : ""}${offeringList}`;
  }).join("\n");
}

// Resolve [[venue:uuid]] tags into [[venue:uuid:Name]] so the client can render chips
function resolveVenueTags(text: string, venues: VenueRow[]): string {
  return text.replace(/\[\[venue:([^\]]+)\]\]/g, (match, id) => {
    const venue = venues.find((v) => v.id === id);
    if (venue) return `[[venue:${venue.id}:${venue.name}]]`;
    return match;
  });
}

export async function POST(request: Request) {
  // Parse body and auth in parallel
  const [body, authClient] = await Promise.all([request.json(), createAuthClient()]);
  const { message } = body;

  if (!message) {
    return Response.json({ reply: "Missing message." }, { status: 400 });
  }

  const { data: { user: authUser } } = await authClient.auth.getUser();
  const userId = authUser?.id || null;

  // Fetch venues + offerings + preferences in parallel
  const [venues, offerings, prefsContext] = await Promise.all([
    getActiveVenues(),
    getActiveOfferings(),
    userId ? getPreferencesContext(userId) : Promise.resolve(""),
  ]);
  const directory = buildVenueDirectory(venues, offerings);

  const context = [
    "You are KickBack's concierge — the master agent for theKickBack platform. CRITICAL: Never mention texting, SMS, phone numbers, or 'text JOIN.' There is no texting feature. Everything happens through this chat.",
    "Help users discover venues, answer general questions, and make recommendations.",
    "",
    "VENUE CARD INSTRUCTIONS:",
    "When recommending a venue, use: [[VENUE_CARD:venue-id-here]]",
    "This renders a full venue card with stats, vibe, and a chat button.",
    "Use VENUE_CARD for specific recommendations. You can include multiple cards.",
    "Use the exact venue ID from the list below.",
    "",
    "For casual mentions without a full card, use: [[venue:venue-id-here]]",
    "This renders a small tappable chip.",
    "",
    "OFFERING LINK INSTRUCTIONS:",
    "When mentioning a specific offering (product, service, event, membership), link it inline:",
    "[[OFFER:offering-id:Offering Name:price_cents]]",
    "Example: 'Check out [[OFFER:abc-123:Classic Fade:2500]] at Tight Lines or [[OFFER:def-456:Latte Art Class:1500]] at Drip.'",
    "This renders a tappable offering chip guests can add to cart or book.",
    "Use these when someone asks 'what can I buy', 'any events', 'haircuts near me', etc.",
    "Always pair offerings with their venue using VENUE_CARD or [[venue:id]].",
    "",
    "Active venues:",
    directory,
    "",
    prefsContext || "",
    `User says: "${message}"`,
    "",
    "Keep responses concise (2-4 sentences). No emojis. Be direct and helpful.",
    "Always use VENUE_CARD when the user asks where to go, what's good, or for recommendations.",
    "When the user asks about specific services or products (haircuts, coffee, events, food), show the relevant OFFER links from the offerings listed above.",
    "You are a discovery engine — help users find things to do, buy, book, and experience across all venues.",
    "",
    "IMPORTANT RULES:",
    "- NEVER tell users to text, SMS, or call any number. There is no texting feature.",
    "- Everything happens through this chat — browsing, ordering, booking, joining.",
    "- To get started: users just tap a venue on the map and start chatting.",
    "- To join a membership: tap the venue, browse offerings, and purchase through the chat.",
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
            model: "openclaw",
            input: context,
            stream: true,
          }),
        });

        if (res.ok && res.body) {
          const contentType = res.headers.get("content-type") || "";

          if (contentType.includes("text/event-stream")) {
            // Streaming response
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
            // Non-streaming JSON fallback
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
            occupancy: v.occupancy,
            capacity: v.max_occupancy,
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

      // Save to thread (non-blocking, non-critical)
      if (userId) {
        Promise.all([
          supabase.rpc("save_thread_message", { p_user_id: userId, p_venue_id: null, p_sender_type: "guest", p_body: message }),
          supabase.rpc("save_thread_message", { p_user_id: userId, p_venue_id: null, p_sender_type: "ai", p_body: reply }),
        ]).then(() => {}, () => {});
        extractPreferences(userId, message, reply, null).catch(() => {});
      }

      // Send final metadata event
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({
        type: "done",
        reply,
        venues: referencedVenues,
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
