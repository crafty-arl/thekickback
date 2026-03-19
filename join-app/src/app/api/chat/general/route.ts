import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function getVenueDirectory(): Promise<string> {
  const { data } = await supabase
    .from("venues")
    .select("id, name, state, vibe, occupancy, max_occupancy")
    .eq("state", "active")
    .order("name");

  if (!data || data.length === 0) return "No venues currently active.";

  return data
    .map(
      (v) =>
        `- ${v.name} (id: ${v.id}) — ${v.vibe}, ${v.occupancy}/${v.max_occupancy} people`
    )
    .join("\n");
}

export async function POST(request: Request) {
  const { message } = await request.json();

  if (!message) {
    return Response.json({ reply: "Missing message." }, { status: 400 });
  }

  const venues = await getVenueDirectory();

  const context = [
    "You are KickBack's concierge — the master agent for theKickBack platform.",
    "Help users discover venues, answer general questions, and make recommendations.",
    "When you recommend a venue, include its ID like this: [[venue:the-venue-id]].",
    "The user can tap the venue name to open it.",
    "",
    "Active venues:",
    venues,
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
        reply = text;
        if (reply.length > 500) reply = reply.slice(0, 497) + "...";
      }
    } else {
      console.error("Claw error:", res.status, await res.text());
    }
  } catch (err) {
    console.error("Claw fetch error:", err);
  }

  return Response.json({ reply });
}
