import { createClient } from "@supabase/supabase-js";

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
}

async function getActiveVenues(): Promise<VenueRow[]> {
  const { data } = await supabase
    .from("venues")
    .select("id, name, state, vibe, occupancy, max_occupancy")
    .eq("state", "active")
    .order("name");

  return data || [];
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
  const { message } = await request.json();

  if (!message) {
    return Response.json({ reply: "Missing message." }, { status: 400 });
  }

  const venues = await getActiveVenues();
  const directory = buildVenueDirectory(venues);

  const context = [
    "You are KickBack's concierge — the master agent for theKickBack platform.",
    "Help users discover venues, answer general questions, and make recommendations.",
    "When you recommend a venue, include its ID like this: [[venue:the-venue-id]].",
    "IMPORTANT: Use the exact venue ID from the list below. Do NOT include the venue name inside the brackets.",
    "The user can tap the venue name to open it.",
    "",
    "Active venues:",
    directory,
    "",
    `User says: "${message}"`,
    "",
    "Keep responses concise (1-3 sentences). No emojis. Be direct and helpful.",
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

  return Response.json({ reply });
}
