import { createClient } from "@supabase/supabase-js";
import { createClient as createAuthClient } from "@/lib/supabase/server";
import { extractPreferences, getPreferencesContext } from "@/lib/personalization";

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

function parseBooking(text: string): { reply: string; booking: Record<string, unknown> | null } {
  const match = text.match(/\[\[BOOKING:([\s\S]*?)\]\]/);
  if (!match) return { reply: text, booking: null };

  const reply = text.replace(/\[\[BOOKING:[\s\S]*?\]\]/, "").trim();
  try {
    const booking = JSON.parse(match[1]);
    return { reply, booking };
  } catch {
    return { reply: text.replace(/\[\[BOOKING:[\s\S]*?\]\]/, "").trim(), booking: null };
  }
}

// ─── AI usage gate ─────────────────────────────────────────────
async function checkAiUsageGate(
  venueId: string,
  userId: string | null,
  deviceId: string | null
): Promise<{ allowed: boolean; gateMessage?: string; usage?: number; limit?: number }> {
  const { data: limits } = await supabase
    .from("venue_ai_limits")
    .select("free_messages_per_day, require_membership, gate_message")
    .eq("venue_id", venueId)
    .maybeSingle();

  if (!limits) return { allowed: true };

  // Members skip limits
  if (limits.require_membership && userId) {
    const { data: isMember } = await supabase.rpc("has_venue_membership", {
      p_user_id: userId,
      p_venue_id: venueId,
    });
    if (isMember) return { allowed: true };
  }

  // Increment usage and check count
  const { data: count } = await supabase.rpc("increment_ai_usage", {
    p_venue_id: venueId,
    p_user_id: userId || null,
    p_device_id: !userId ? (deviceId || null) : null,
  });

  const messageCount = count ?? 0;
  if (messageCount > limits.free_messages_per_day) {
    return {
      allowed: false,
      gateMessage: limits.gate_message,
      usage: messageCount,
      limit: limits.free_messages_per_day,
    };
  }

  return { allowed: true, usage: messageCount, limit: limits.free_messages_per_day };
}

export async function POST(request: Request) {
  // Verify authenticated user from session cookie
  const authClient = await createAuthClient();
  const { data: { user: authUser } } = await authClient.auth.getUser();
  const userId = authUser?.id || null;

  const { message, venueId, venueName, vibe, occupancy, table, deviceId } = await request.json();

  if (!message || !venueId) {
    return Response.json({ reply: "Missing message or venue." }, { status: 400 });
  }

  // Check usage limits before calling the AI
  const gate = await checkAiUsageGate(venueId, userId, deviceId);
  if (!gate.allowed) {
    return Response.json({
      reply: gate.gateMessage,
      gated: true,
      usage: gate.usage,
      limit: gate.limit,
    });
  }

  // Fetch venue-specific knowledge, offerings, and user preferences
  const [knowledge, offerings, prefsContext] = await Promise.all([
    getVenueKnowledge(venueId),
    getVenueOfferings(venueId),
    userId ? getPreferencesContext(userId, venueId) : Promise.resolve(""),
  ]);

  // Build context for claw
  const context = [
    `You are the AI agent for ${venueName}. Respond as the venue.`,
    knowledge ? `\nVenue knowledge:\n${knowledge}\n` : "",
    offerings ? `\nAvailable offerings:\n${offerings}\n` : "",
    prefsContext || "",
    `A guest says: "${message}".`,
    `Venue is ${vibe}, ${occupancy} people.`,
    table ? `Guest is at Table ${table}.` : "",
    "Keep it under 280 chars. No emojis. Be direct and helpful.",
    "",
    "CARD INSTRUCTIONS:",
    "Based on what the guest is asking about, include a card type tag at the END of your response:",
    "[[CARD:vibe]] — if they ask about the vibe, energy, crowd, atmosphere, how busy it is",
    "[[CARD:menu]] — if they ask about food, drinks, menu, what you serve",
    "[[CARD:events]] — if they ask about events, shows, what's happening, tonight, this week",
    "[[CARD:reserve]] — if they ask about reserving, booking a table/booth/spot",
    "[[CARD:shop]] — if they ask about buying, ordering, products, prices, what's available",
    "[[CARD:join]] — if they ask about membership, joining, the venue itself, perks, XP",
    "Only include ONE card tag. If the message is general chat, do NOT include any card tag.",
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
      "",
      "BOOKING INSTRUCTIONS:",
      "If the guest wants to RESERVE or BOOK a time slot (booth, table, event) and you have enough info (offering, date/time, and the guest has shared their name/email), include a booking tag:",
      '[[BOOKING:{"offering_id":"uuid-here","start":"2026-03-20T02:00:00Z","attendee_name":"Guest Name","attendee_email":"guest@email.com","attendee_timezone":"America/Chicago"}]]',
      "- Use ISO 8601 UTC for the start time.",
      "- Only generate when the guest explicitly confirms the booking.",
      "- If the guest hasn't given their name or email, ask for it first.",
    ].join("\n") : "",
  ].filter(Boolean).join(" ");

  // Save guest message to thread (or legacy chat_messages if no user)
  if (userId) {
    await supabase.rpc("save_thread_message", {
      p_user_id: userId, p_venue_id: venueId, p_sender_type: "guest", p_body: message,
    });
  } else {
    await supabase.from("chat_messages").insert({ venue_id: venueId, sender_type: "guest", body: message });
  }

  // Forward to claw via OpenResponses API (synchronous, per-venue agent)
  let reply = "Couldn't reach the venue right now. Try again in a moment.";
  let checkout = null;
  let booking: Record<string, unknown> | null = null;
  let card: string | null = null;

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
        const parsedCheckout = parseCheckout(text);
        const parsedBooking = parseBooking(parsedCheckout.reply);
        reply = parsedBooking.reply;
        checkout = parsedCheckout.checkout;
        booking = parsedBooking.booking;

        // Parse [[CARD:type]] tag
        const cardMatch = reply.match(/\[\[CARD:(\w+)\]\]/);
        if (cardMatch) {
          card = cardMatch[1];
          reply = reply.replace(/\[\[CARD:\w+\]\]/, "").trim();
        }

        if (reply.length > 320) reply = reply.slice(0, 317) + "...";
      }
    } else {
      console.error("Claw error:", res.status, await res.text());
    }
  } catch (err) {
    console.error("Claw fetch error:", err);
  }

  // Save AI reply to thread
  if (userId) {
    await supabase.rpc("save_thread_message", {
      p_user_id: userId, p_venue_id: venueId, p_sender_type: "ai", p_body: reply,
    });
  } else {
    await supabase.from("chat_messages").insert({ venue_id: venueId, sender_type: "ai", body: reply });
  }

  // If AI generated a booking tag, execute it
  let bookingResult = null;
  if (booking) {
    try {
      const bookRes = await fetch(
        `${request.headers.get("origin") || "http://localhost:3000"}/api/book`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            venueId,
            offeringId: (booking as Record<string, unknown>).offering_id,
            start: (booking as Record<string, unknown>).start,
            attendeeName: (booking as Record<string, unknown>).attendee_name,
            attendeeEmail: (booking as Record<string, unknown>).attendee_email,
            attendeeTimezone: (booking as Record<string, unknown>).attendee_timezone || "America/Chicago",
          }),
        }
      );
      if (bookRes.ok) {
        bookingResult = await bookRes.json();
      } else {
        console.error("Booking API error:", bookRes.status, await bookRes.text());
      }
    } catch (err) {
      console.error("Booking fetch error:", err);
    }
  }

  // Async preference extraction (fire-and-forget)
  if (userId) {
    extractPreferences(userId, message, reply, venueId, venueName).catch(() => {});
  }

  return Response.json({ reply, checkout, booking: bookingResult, card });
}
