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

function buildVenueDirectory(venues: VenueRow[]): string {
  if (venues.length === 0) return "No venues currently active.";

  return venues
    .map(
      (v) =>
        `- ${v.name} (id: ${v.id}) — ${v.vibe}, ${v.occupancy}/${v.max_occupancy} people`
    )
    .join("\n");
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
  // Verify authenticated user from session cookie
  const authClient = await createAuthClient();
  const { data: { user: authUser } } = await authClient.auth.getUser();
  const userId = authUser?.id || null;

  const { message } = await request.json();

  if (!message) {
    return Response.json({ reply: "Missing message." }, { status: 400 });
  }

  const [venues, prefsContext] = await Promise.all([
    getActiveVenues(),
    userId ? getPreferencesContext(userId) : Promise.resolve(""),
  ]);
  const directory = buildVenueDirectory(venues);

  const context = [
    "You are KickBack's concierge — the master agent for theKickBack platform.",
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
    "Active venues:",
    directory,
    "",
    prefsContext || "",
    `User says: "${message}"`,
    "",
    "Keep responses concise (1-3 sentences). No emojis. Be direct and helpful.",
    "Always use VENUE_CARD when the user asks where to go, what's good, or for recommendations.",
  ].join("\n");

  let reply = "Something went wrong. Try again in a moment.";

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
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const msg = data.output?.find(
        (o: { type: string }) => o.type === "message"
      );
      const text = msg?.content?.find(
        (c: { type: string; text?: string }) => c.type === "output_text"
      )?.text;
      if (text) {
        reply = resolveVenueTags(text, venues);
        if (reply.length > 600) reply = reply.slice(0, 597) + "...";
      }
    } else {
      console.error("Claw error:", res.status, await res.text());
    }
  } catch (err) {
    console.error("Claw fetch error:", err);
  }

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

  // Async preference extraction (fire-and-forget)
  if (userId) {
    extractPreferences(userId, message, reply, null).catch(() => {});
  }

  return Response.json({ reply, venues: referencedVenues });
}
