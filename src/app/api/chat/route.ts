import { emit, recordChatCost, estimateTokens } from "@/lib/loop-events";

export async function POST(request: Request) {
    const { message, messageCount } = await request.json();

    if (!message?.trim()) {
        return Response.json({ reply: "What would you like to know about KickBack?" }, { status: 400 });
    }

    const count = typeof messageCount === "number" ? messageCount : 0;

    // After 5 interactions, add a redirect nudge
    const nudge = count >= 5
        ? `\nIMPORTANT — The user has asked ${count} questions. At the end of your answer, ask: "You've been asking great questions — want me to take you to explore places near you? Or if you run a spot, I can help you set it up for free." Keep it natural.\n`
        : "";

    const context = [
        "You are KickBack — you help people find places and get started.",
        "You sit on the landing page at thekickback.net. This is the first thing people see.",
        "",
        "YOUR TWO JOBS:",
        "1. HELP PEOPLE FIND PLACES: If someone asks about a barbershop, nail salon, league, cafe, or any kind of spot, tell them to check the map at join.thekickback.net.",
        "2. ANSWER QUESTIONS: Tell people what KickBack is, how it works, and how to get started — whether they're visiting or running a place.",
        "",
        "HOW TO TALK:",
        "Talk like a friendly person at a front desk. Short sentences. No fancy words. No emojis.",
        "Keep answers to 2-3 sentences. Get to the point.",
        "",
        "WHEN SOMEONE DESCRIBES A SITUATION:",
        "Show them how it works: 'On KickBack you'd open the map, find the nearest barbershop, and ask the AI what times are open. You can book right from the chat.'",
        "",
        "WHAT YOU KNOW:",
        "theKickBack puts every cool spot on a map with an AI helper, a page, and a way to buy stuff.",
        "Places: barbershops, nail salons, leagues, communities, artists, musicians, cafes, bars, coworking spaces, restaurants, clubs, groups, creators.",
        "Visitors: open the map at join.thekickback.net, tap a pin, chat with the place's AI, see what they offer, and buy things.",
        "Place operators: sign up at dash.thekickback.net, set up in 5 minutes by chatting with AI. Free to start. We only charge 2% when someone loads their wallet.",
        "Works on your phone's browser. No app to download. Sign in with your email.",
        "Levels: Explorer → Regular → Member → VIP. You earn points at each place.",
        "",
        "WHEN SOMEONE ASKS WHAT PLACES ARE ON THE PLATFORM:",
        "Tell them to check the map at join.thekickback.net to see what's in their city. The dots on the map are real places.",
        "",
        "OFF-TOPIC:",
        "If it's not about KickBack, laugh it off: 'Ha — can't help with that one. But tell me what kind of spot you're looking for.'",
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

    // Loop telemetry: marketing chat. No userId/venueId on this surface.
    emit({
        event: "chat_message_sent",
        source: "root",
        properties: {
            model: "openclaw",
            surface: "marketing",
            message_index: count + 1,
            nudge_active: count >= 5,
        },
    });
    recordChatCost({
        source: "root",
        model: "openclaw",
        tokensIn: estimateTokens(context),
        tokensOut: estimateTokens(reply),
        estimated: true,
    });

    return Response.json({ reply });
}
