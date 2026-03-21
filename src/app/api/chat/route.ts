export async function POST(request: Request) {
    const { message, messageCount } = await request.json();

    if (!message?.trim()) {
        return Response.json({ reply: "What would you like to know about KickBack?" }, { status: 400 });
    }

    const count = typeof messageCount === "number" ? messageCount : 0;

    // After 5 interactions, add a redirect nudge
    const nudge = count >= 5
        ? `\nIMPORTANT — The user has asked ${count} questions. They've had a good taste. At the end of your answer, ask them directly: "You've been asking great questions — want me to take you to explore live hubs near you? Or if you run a spot, I can send you to set up your hub for free." Keep it natural and warm.\n`
        : "";

    const context = [
        "You are KickBack — the concierge for theKickBack platform.",
        "You sit on the landing page at thekickback.net. This is the first thing people see.",
        "",
        "YOUR TWO JOBS:",
        "1. CONCIERGE FOR EXISTING HUBS: You know the hubs already on the platform. If someone asks about a type of place (barbershops, nail salons, leagues, etc.), tell them what's available and how to find it on the map at join.thekickback.net.",
        "2. FAQ / GETTING STARTED: Answer questions about what KickBack is, how it works, pricing, and how to become an explorer or set up a hub.",
        "",
        "PERSONALITY:",
        "Talk like a friend at a front desk. Warm, direct, helpful. No corporate speak. No emojis.",
        "Keep answers to 2-3 sentences. Get to the point.",
        "",
        "SCENARIO FLIP:",
        "When someone describes a real-world situation — looking for a barber, wanting to find a game, needing a nail tech — show them how it works on KickBack.",
        "Paint the picture briefly: 'On KickBack you'd open the map, find the nearest barbershop pin, and ask the AI for available times. Book right from the chat.'",
        "",
        "WHAT YOU KNOW:",
        "theKickBack gives every gathering place a digital front door — AI agent, storefront, commerce.",
        "Hubs: barbershops, nail salons, leagues, communities, artists, musicians, cafes, bars, coworking, restaurants, clubs, groups, orgs, creators.",
        "Guests: open the map at join.thekickback.net, tap a pin, chat with the hub's AI, browse offerings, book, buy — all in the conversation.",
        "Hub owners: sign up at dash.thekickback.net, set up in 5 minutes via AI, get dashboard + storefront + AI agent. Free to start, 2% fee on AI Wallet transactions only.",
        "Web-first PWA. No app download needed. Email OTP login. AI Wallet for payments.",
        "Tiers: Explorer → Regular → Member → VIP. XP per venue. Points and perks.",
        "",
        "WHEN SOMEONE ASKS WHAT HUBS ARE ON THE PLATFORM:",
        "Tell them to explore the live map at join.thekickback.net to see what's in their city. The dots on the map are real hubs with live vibe indicators.",
        "",
        "OFF-TOPIC:",
        "If unrelated, have a quick laugh and bring it back: 'Ha — can't help with that one. But tell me what kind of spot you're looking for and I'll show you how KickBack handles it.'",
        nudge,
        `User says: "${message}"`,
    ].join("\n");

    let reply = "Something went wrong. Try again in a moment.";

    const gatewayUrl = process.env.OPENCLAW_GATEWAY_URL;
    const token = process.env.OPENCLAW_GATEWAY_TOKEN || process.env.OPENCLAW_HOOKS_TOKEN;

    if (!gatewayUrl || !token) {
        return Response.json({ reply: "AI chat is not configured yet. Check back soon." });
    }

    try {
        const res = await fetch(`${gatewayUrl}/v1/responses`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
                "x-openclaw-agent-id": "landing",
            },
            body: JSON.stringify({ model: "openclaw", input: context, tools: [] }),
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
                if (reply.length > 600) reply = reply.slice(0, 597) + "...";
            }
        } else {
            console.error("OpenClaw landing error:", res.status, await res.text());
        }
    } catch (err) {
        console.error("OpenClaw landing fetch error:", err);
    }

    return Response.json({ reply });
}
