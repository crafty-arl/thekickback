import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

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

export async function POST(request: Request) {
  const { message, venueId, venueName, vibe, occupancy, table } = await request.json();

  if (!message || !venueId) {
    return Response.json({ reply: "Missing message or venue." }, { status: 400 });
  }

  // Fetch venue-specific knowledge
  const knowledge = await getVenueKnowledge(venueId);

  // Build context for claw
  const context = [
    `You are the AI agent for ${venueName}. Respond as the venue.`,
    knowledge ? `\nVenue knowledge:\n${knowledge}\n` : "",
    `A guest says: "${message}".`,
    `Venue is ${vibe}, ${occupancy} people.`,
    table ? `Guest is at Table ${table}.` : "",
    "Keep it under 160 chars. No emojis. Be direct and helpful.",
  ].filter(Boolean).join(" ");

  // Save guest message to chat_messages
  await supabase.from("chat_messages").insert({
    venue_id: venueId,
    sender_type: "guest",
    body: message,
  });

  // Forward to claw via OpenResponses API (synchronous, per-venue agent)
  let reply = "Couldn't reach the venue right now. Try again in a moment.";

  try {
    const res = await fetch(`${process.env.OPENCLAW_GATEWAY_URL}/v1/responses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENCLAW_GATEWAY_TOKEN}`,
        "Content-Type": "application/json",
        "x-openclaw-agent-id": `venue-${venueId}`,
      },
      body: JSON.stringify({
        model: "openclaw",
        input: context,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const msg = data.output?.find((o: { type: string }) => o.type === "message");
      const text = msg?.content?.find((c: { type: string; text?: string }) => c.type === "output_text")?.text;
      if (text) {
        reply = text;
        if (reply.length > 320) reply = reply.slice(0, 317) + "...";
      }
    } else {
      console.error("Claw error:", res.status, await res.text());
    }
  } catch (err) {
    console.error("Claw fetch error:", err);
  }

  // Save AI reply to chat_messages
  await supabase.from("chat_messages").insert({
    venue_id: venueId,
    sender_type: "ai",
    body: reply,
  });

  return Response.json({ reply });
}
