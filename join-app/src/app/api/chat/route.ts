import { createClient } from "@supabase/supabase-js";
import { createClient as createAuthClient } from "@/lib/supabase/server";
import { extractPreferences, getPreferencesContext } from "@/lib/personalization";
import { getRecentChatHistory } from "@/lib/chat-history";

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

interface OfferingRow {
  id: string; type: string; name: string; description: string | null;
  price_cents: number; recurring: boolean; interval: string | null;
  duration_minutes: number | null; capacity: number | null;
  add_ons: { name: string; price_cents: number }[] | null;
  category: string | null; image_url: string | null;
}

async function getVenueOfferingsRaw(venueId: string): Promise<OfferingRow[]> {
  const { data } = await supabase
    .from("venue_offerings")
    .select("id, type, name, description, price_cents, recurring, interval, duration_minutes, capacity, add_ons, category, image_url")
    .eq("venue_id", venueId)
    .eq("active", true)
    .order("sort_order");
  return (data || []) as OfferingRow[];
}

function formatOfferingsForPrompt(data: OfferingRow[]): string {
  if (data.length === 0) return "";
  return data.map((o) => {
    const price = o.price_cents === 0 ? "Free" : `$${(o.price_cents / 100).toFixed(2)}${o.recurring ? `/${o.interval || "mo"}` : ""}`;
    const duration = o.duration_minutes ? ` (${o.duration_minutes} min)` : "";
    const addOns = o.add_ons?.length
      ? ` | Add-ons: ${o.add_ons.map((a) => `${a.name} $${(a.price_cents / 100).toFixed(2)}`).join(", ")}`
      : "";
    return `- [${o.type}] "${o.name}" ${price}${duration}${addOns} (id:${o.id})`;
  }).join("\n");
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
  // Parse body and auth in parallel
  const [body, authClient] = await Promise.all([request.json(), createAuthClient()]);
  const { message, venueId, venueName, vibe, occupancy, table, deviceId, timezone } = body;
  const userTimezone = timezone || "America/Chicago";

  if (!message || !venueId) {
    return Response.json({ reply: "Missing message or venue." }, { status: 400 });
  }

  const { data: { user: authUser } } = await authClient.auth.getUser();
  const userId = authUser?.id || null;
  const userEmail = authUser?.email || null;
  const userName = userEmail?.split("@")[0] || "Guest";

  // Check usage limits + fetch venue data in parallel
  const [gate, knowledge, offeringsRaw, prefsContext, chatHistory] = await Promise.all([
    checkAiUsageGate(venueId, userId, deviceId),
    getVenueKnowledge(venueId),
    getVenueOfferingsRaw(venueId),
    userId ? getPreferencesContext(userId, venueId) : Promise.resolve(""),
    userId ? getRecentChatHistory(userId, venueId, 10) : Promise.resolve(""),
  ]);

  if (!gate.allowed) {
    return Response.json({
      reply: gate.gateMessage,
      gated: true,
      usage: gate.usage,
      limit: gate.limit,
    });
  }
  const offerings = formatOfferingsForPrompt(offeringsRaw);

  // Build offerings lookup for the client (id → metadata)
  const offeringsMap: Record<string, {
    name: string; description: string | null; price_cents: number;
    image_url: string | null; type: string; recurring: boolean;
    interval: string | null; duration_minutes: number | null;
    add_ons: { name: string; price_cents: number }[] | null;
  }> = {};
  for (const o of offeringsRaw) {
    offeringsMap[o.id] = {
      name: o.name, description: o.description, price_cents: o.price_cents,
      image_url: o.image_url, type: o.type, recurring: o.recurring,
      interval: o.interval, duration_minutes: o.duration_minutes,
      add_ons: o.add_ons,
    };
  }

  // Build context for claw
  const context = [
    `You are the AI agent for ${venueName}. Respond as the venue. CRITICAL: Never mention texting, SMS, phone numbers, or "text JOIN." There is no texting feature. Everything happens through this chat.`,
    knowledge ? `\nVenue knowledge:\n${knowledge}\n` : "",
    offerings ? `\nAvailable offerings:\n${offerings}\n` : "",
    prefsContext || "",
    chatHistory || "",
    `A guest says: "${message}".`,
    `Venue is ${vibe}, ${occupancy} people.`,
    table ? `Guest is at Table ${table}.` : "",
    "Keep it under 400 chars. No emojis. Be direct and helpful.",
    "NEVER tell users to text, SMS, or call a number. Everything happens through this chat. Don't mention phone numbers or texting.",
    "",
    "OFFERING LINK INSTRUCTIONS:",
    "When mentioning a specific offering, link it inline using: [[OFFER:id:name:price_cents]]",
    "Use the exact id, name, and price_cents from the offerings list above.",
    "Example: 'We have [[OFFER:abc-123:House Cocktail:1400]] and [[OFFER:def-456:Beer Flight:1200]].'",
    "This lets guests tap to view details and add to cart. You can mention multiple offerings in one response.",
    "Only link offerings that are relevant to what the guest asked. Don't dump the whole list.",
    "",
    "SMART SUGGESTIONS:",
    "- If the guest seems like they'd benefit from a membership (ordering often, asking about perks, multiple visits), suggest the membership offering with its link.",
    "- If the guest asks for multiple items or a 'package deal', group them: 'Here's what I'd put together for you:' then list each offering link.",
    "- If the guest says 'add to cart', 'I want all of those', or similar, list all relevant items with their [[OFFER:...]] links so they can add each one.",
    "- Act like a knowledgeable server or concierge — recommend pairings, upsell naturally, suggest add-ons.",
    "",
    offerings ? [
      "CHECKOUT INSTRUCTIONS:",
      "If the guest wants to order or purchase a PRODUCT (not a service/reservation/event), respond conversationally AND include a checkout card at the END of your response in this exact format:",
      '[[CHECKOUT:{"items":[{"offering_id":"uuid-here","name":"House Cocktail","description":"Our signature drink","quantity":1,"unit_price_cents":1400,"metadata":{}}],"add_ons":[]}]]',
      "Rules:",
      "- Only generate a checkout for PRODUCTS and MEMBERSHIPS — never for services, reservations, or events that have a duration.",
      "- For services/reservations/events (anything with duration_minutes): tell the guest to use the booking scheduler by tapping the offering. Say something like 'Tap the offering below to pick a time.'",
      "- NEVER put a service or reservation in a [[CHECKOUT]] without date and time. It will be rejected.",
      "- Use the exact offering_id from the offerings list above.",
      "- price_cents must match the offering price.",
      "- Never invent offerings that aren't in the list.",
      "",
      "BOOKING INSTRUCTIONS:",
      "The user is authenticated. Their email is " + (userEmail || "unknown") + " and name is " + userName + ".",
      "",
      "NATURAL LANGUAGE BOOKING — when a guest says something like 'book a haircut for tomorrow at 3pm' or 'reserve a table Friday 7pm':",
      "1. Identify the offering from the list above",
      "2. Parse the date and time from their message (convert 'tomorrow' to an actual date, 'next Friday' etc.)",
      "3. Generate the booking tag immediately — no need to ask for confirmation if they gave a clear date+time+offering",
      "",
      "If the guest says a time but it's vague ('sometime this week', 'in the afternoon'), ask them to pick a specific time.",
      "If the guest asks about a service WITHOUT mentioning a time, show the offering link and say 'tap to pick a time that works.'",
      "",
      `Today is ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}.`,
      "",
      "Booking tag format:",
      `[[BOOKING:{"offering_id":"uuid-here","start":"YYYY-MM-DDTHH:MM:00Z","attendee_name":"${userName}","attendee_email":"${userEmail || "guest@kickback.app"}","attendee_timezone":"${userTimezone}"}]]`,
      "- Use ISO 8601 UTC for the start time.",
      "- Do NOT ask for name or email — the user is already authenticated.",
      "- NEVER generate [[BOOKING]] without a real date and time.",
    ].join("\n") : "",
  ].filter(Boolean).join(" ");

  // Save guest message to thread (non-blocking)
  if (userId) {
    supabase.rpc("save_thread_message", {
      p_user_id: userId, p_venue_id: venueId, p_sender_type: "guest", p_body: message,
    }).then(() => {}, () => {});
  }

  const encoder = new TextEncoder();
  const origin = request.headers.get("origin") || "http://localhost:3000";

  const stream = new ReadableStream({
    async start(controller) {
      let fullText = "";
      let streamOk = false;

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
            stream: true,
          }),
        });

        if (res.ok && res.body) {
          const contentType = res.headers.get("content-type") || "";

          if (contentType.includes("text/event-stream")) {
            // Streaming response
            streamOk = true;
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
            // Non-streaming JSON response (fallback)
            const data = await res.json();
            const msg = data.output?.find((o: { type: string }) => o.type === "message");
            const text = msg?.content?.find((c: { type: string; text?: string }) => c.type === "output_text")?.text;
            if (text) {
              fullText = text;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "delta", text })}\n\n`));
            }
          }
        } else {
          // Error fallback
          const errText = res.ok ? "" : await res.text().catch(() => "");
          console.error("Claw error:", res.status, errText);
          fullText = "Couldn't reach the venue right now. Try again in a moment.";
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "delta", text: fullText })}\n\n`));
        }
      } catch (err) {
        console.error("Claw fetch error:", err);
        fullText = "Couldn't reach the venue right now. Try again in a moment.";
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "delta", text: fullText })}\n\n`));
      }

      // Parse tags from full accumulated text
      const parsedCheckout = parseCheckout(fullText);
      const parsedBooking = parseBooking(parsedCheckout.reply);
      let reply = parsedBooking.reply;
      const checkout = parsedCheckout.checkout;
      let booking = parsedBooking.booking;

      // Strip processed tags (CHECKOUT, BOOKING) but keep OFFER tags for client rendering
      reply = reply
        .replace(/\[\[CHECKOUT:[\s\S]*?\]\]/g, "")
        .replace(/\[\[BOOKING:[\s\S]*?\]\]/g, "")
        .replace(/\[\[REPLIES:[\s\S]*?\]\]/g, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
      if (reply.length > 400) reply = reply.slice(0, 397) + "...";

      // Save AI reply to thread (non-blocking)
      if (userId) {
        supabase.rpc("save_thread_message", {
          p_user_id: userId, p_venue_id: venueId, p_sender_type: "ai", p_body: reply,
        }).then(() => {}, () => {});
      }

      // If AI generated a booking tag, validate and execute it
      let bookingResult = null;
      if (booking) {
        const bStart = (booking as Record<string, unknown>).start as string | undefined;
        if (!bStart || isNaN(new Date(bStart).getTime())) {
          booking = null;
          console.warn("AI generated [[BOOKING]] without valid start time, dropping it");
        }
      }
      if (booking) {
        try {
          const bookRes = await fetch(`${origin}/api/book`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              venueId,
              offeringId: (booking as Record<string, unknown>).offering_id,
              start: (booking as Record<string, unknown>).start,
              attendeeName: userName || (booking as Record<string, unknown>).attendee_name || "Guest",
              attendeeEmail: userEmail || (booking as Record<string, unknown>).attendee_email || "guest@kickback.app",
              attendeeTimezone: (booking as Record<string, unknown>).attendee_timezone || userTimezone,
            }),
          });
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

      // Send final metadata event
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({
        type: "done",
        reply,
        checkout,
        booking: bookingResult,
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
