import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function POST(request: Request) {
  const { message, venueId, venueName, vibe, occupancy, table } = await request.json();

  if (!message || !venueId) {
    return Response.json({ reply: "Missing message or venue." }, { status: 400 });
  }

  // Build context for claw
  const context = [
    `A guest at ${venueName} says: "${message}".`,
    `Venue is ${vibe}, ${occupancy} people.`,
    table ? `Guest is at Table ${table}.` : "",
    "Respond as the venue. Keep it under 160 chars. No emojis. Be direct and helpful.",
  ].filter(Boolean).join(" ");

  // Save guest message to chat_messages
  await supabase.from("chat_messages").insert({
    venue_id: venueId,
    sender_type: "guest",
    body: message,
  });

  // Forward to claw
  let reply = "Couldn't reach the venue right now. Try again in a moment.";

  try {
    const res = await fetch(`${process.env.OPENCLAW_GATEWAY_URL}/hooks/agent`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENCLAW_HOOKS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: context,
        agentId: "main",
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.payloads?.[0]?.text) {
        reply = data.payloads[0].text;
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
