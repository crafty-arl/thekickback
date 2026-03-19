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

async function getVenueOfferings(venueId: string): Promise<string> {
  const { data } = await supabase
    .from("venue_offerings")
    .select("id, type, name, description, price_cents, recurring, interval, duration_minutes, capacity, add_ons, category")
    .eq("venue_id", venueId)
    .eq("active", true)
    .order("sort_order");

  if (!data || data.length === 0) return "";

  return data
    .map((o) => {
      const price = o.price_cents === 0
        ? "Free"
        : `$${(o.price_cents / 100).toFixed(2)}${o.recurring ? `/${o.interval || "mo"}` : ""}`;
      const duration = o.duration_minutes ? ` (${o.duration_minutes} min)` : "";
      const addOns = o.add_ons?.length
        ? ` | Add-ons: ${o.add_ons.map((a: { name: string; price_cents: number }) => `${a.name} $${(a.price_cents / 100).toFixed(2)}`).join(", ")}`
        : "";
      return `- [${o.type}] "${o.name}" ${price}${duration}${addOns} (id:${o.id})`;
    })
    .join("\n");
}

function parseCheckout(text: string): { reply: string; checkout: Record<string, unknown> | null } {
  const match = text.match(/\[\[CHECKOUT:([\s\S]*?)\]\]/);
  if (!match) return { reply: text, checkout: null };

  const reply = text.replace(/\[\[CHECKOUT:[\s\S]*?\]\]/, "").trim();
  try {
    const checkout = JSON.parse(match[1]);
    return { reply, checkout };
  } catch {
    return { reply: text.replace(/\[\[CHECKOUT:[\s\S]*?\]\]/, "").trim(), checkout: null };
  }
}

export async function POST(request: Request) {
  const { message, venueId, venueName, vibe, occupancy, table } = await request.json();

  if (!message || !venueId) {
    return Response.json({ reply: "Missing message or venue." }, { status: 400 });
  }

  // Fetch venue-specific knowledge and offerings
  const [knowledge, offerings] = await Promise.all([
    getVenueKnowledge(venueId),
    getVenueOfferings(venueId),
  ]);

  // Build context for claw
  const context = [
    `You are the AI agent for ${venueName}. Respond as the venue.`,
    knowledge ? `\nVenue knowledge:\n${knowledge}\n` : "",
    offerings ? `\nAvailable offerings:\n${offerings}\n` : "",
    `A guest says: "${message}".`,
    `Venue is ${vibe}, ${occupancy} people.`,
    table ? `Guest is at Table ${table}.` : "",
    "Keep it under 280 chars. No emojis. Be direct and helpful.",
    "",
    offerings ? [
      "CHECKOUT INSTRUCTIONS:",
      "If the guest wants to book, reserve, order, or purchase something that matches an available offering, respond conversationally AND include a checkout card at the END of your response in this exact format:",
      '[[CHECKOUT:{"items":[{"offering_id":"uuid-here","name":"Booth 7 (Window)","description":"Seats 6, window view","quantity":1,"unit_price_cents":5000,"metadata":{"date":"Fri Mar 20","time":"9:00 PM","guests":4}}],"add_ons":[{"name":"Bottle Service","price_cents":12000,"offering_id":"uuid-or-null"}],"date":"Fri Mar 20","time":"9:00 PM","guests":4}]]',
      "Rules:",
      "- Only generate a checkout when the guest clearly wants to purchase/book/reserve.",
      "- Use the exact offering_id from the offerings list above.",
      "- price_cents must match the offering price.",
      "- Include relevant add_ons from the offering's add-ons list if applicable.",
      "- Include date/time/guests if the guest mentioned them.",
      "- If the guest hasn't specified enough details (like date or time), ask — don't generate a checkout yet.",
      "- Never invent offerings that aren't in the list.",
    ].join("\n") : "",
  ].filter(Boolean).join(" ");

  // Save guest message to chat_messages
  await supabase.from("chat_messages").insert({
    venue_id: venueId,
    sender_type: "guest",
    body: message,
  });

  // Forward to claw via OpenResponses API (synchronous, per-venue agent)
  let reply = "Couldn't reach the venue right now. Try again in a moment.";
  let checkout = null;

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
        const parsed = parseCheckout(text);
        reply = parsed.reply;
        checkout = parsed.checkout;
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

  return Response.json({ reply, checkout });
}
