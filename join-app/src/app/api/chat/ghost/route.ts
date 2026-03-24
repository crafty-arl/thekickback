import { createClient as createAuthClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Ghost agent for unclaimed venues — uses Foursquare public data
export async function POST(request: Request) {
  const authClient = await createAuthClient();
  const { data: { user } } = await authClient.auth.getUser();

  const { message, venueId, venueName, category, neighborhood, description, tags } = await request.json();

  if (!message || !venueId) {
    return Response.json({ reply: "Missing message or venue." }, { status: 400 });
  }

  // Try to get richer Foursquare data if we have the FSQ ID
  let fsqDetails = "";
  const fsqId = venueId.startsWith("fsq-") ? venueId.replace("fsq-", "") : null;

  if (fsqId && process.env.FOURSQUARE_SERVICE_TOKEN) {
    try {
      const fields = "description,hours,price,website,tel,rating,tips";
      const res = await fetch(
        `https://api.foursquare.com/v3/places/${fsqId}?fields=${fields}`,
        {
          headers: { Authorization: process.env.FOURSQUARE_SERVICE_TOKEN, Accept: "application/json" },
        }
      );
      if (res.ok) {
        const data = await res.json();
        const parts: string[] = [];
        if (data.description) parts.push(`About: ${data.description}`);
        if (data.hours?.display) parts.push(`Hours: ${data.hours.display}`);
        if (data.price) parts.push(`Price level: ${"$".repeat(data.price)}`);
        if (data.rating) parts.push(`Rating: ${data.rating}/10`);
        if (data.website) parts.push(`Website: ${data.website}`);
        if (data.tel) parts.push(`Phone: ${data.tel}`);
        if (data.tips?.length) {
          const topTips = data.tips.slice(0, 3).map((t: { text: string }) => `"${t.text}"`).join(" | ");
          parts.push(`What people say: ${topTips}`);
        }
        fsqDetails = parts.join("\n");
      }
    } catch {
      // Foursquare fetch failed — continue with basic data
    }
  }

  // Build ghost agent context
  const context = [
    `You are a helpful guide for ${venueName}. This venue hasn't claimed their KickBack page yet, so you're working with public information only. CRITICAL: Never mention texting, SMS, phone numbers, or "text JOIN." Everything happens through this chat.`,
    "",
    "What you know:",
    `- Name: ${venueName}`,
    category ? `- Type: ${category}` : "",
    neighborhood ? `- Area: ${neighborhood}` : "",
    description ? `- Address: ${description}` : "",
    tags?.length ? `- Tags: ${tags.join(", ")}` : "",
    fsqDetails ? `\nPublic details:\n${fsqDetails}` : "",
    "",
    `A guest asks: "${message}"`,
    "",
    "Rules:",
    "- Be helpful with what you know. Answer questions naturally.",
    "- If asked something you don't have data for (like menu specifics or real-time availability), be honest: \"I don't have that info since this place hasn't set up their KickBack page yet.\"",
    "- Gently mention that the place could claim their page for the full experience — but don't be pushy about it.",
    "- If the user asks about nearby places, suggest they check the KickBack map.",
    "- Keep it under 200 chars. No emojis. Conversational and warm.",
    "- NEVER mention texting, SMS, or phone numbers. Everything is through this chat.",
    "",
    "CARD INSTRUCTIONS:",
    "If the guest asks about the vibe or atmosphere, include: [[CARD:vibe]]",
    "If asking about food/drinks/menu, include: [[CARD:menu]]",
    "If asking about events or what's happening, include: [[CARD:events]]",
    "General chat = no card tag.",
  ].filter(Boolean).join("\n");

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
            "x-openclaw-agent-id": `ghost-${venueId}`,
          },
          body: JSON.stringify({ model: "openclaw", input: context, stream: true }),
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
          console.error("Ghost agent error:", res.status, await res.text().catch(() => ""));
          fullText = "I don't have much info on this spot yet — they haven't set up their KickBack page.";
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "delta", text: fullText })}\n\n`));
        }
      } catch (err) {
        console.error("Ghost agent error:", err);
        fullText = "I don't have much info on this spot yet — they haven't set up their KickBack page.";
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "delta", text: fullText })}\n\n`));
      }

      // Parse card tag
      let reply = fullText;
      let card: string | null = null;
      const cardMatch = reply.match(/\[\[CARD:(\w+)\]\]/);
      if (cardMatch) {
        card = cardMatch[1];
        reply = reply.replace(/\[\[CARD:\w+\]\]/, "").trim();
      }

      if (reply.length > 280) reply = reply.slice(0, 277) + "...";

      // Send final metadata event
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({
        type: "done",
        reply,
        card,
        ghost: true,
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
