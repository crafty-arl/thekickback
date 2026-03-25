import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

/**
 * Load user memory (markdown string from profiles.memory).
 * Injected into AI prompt as context.
 */
export async function getUserMemory(userId: string): Promise<string> {
  const { data } = await supabase
    .from("profiles")
    .select("memory")
    .eq("id", userId)
    .single();

  if (!data?.memory) return "";

  return `\nWhat you know about this guest (from past conversations):\n${data.memory}\nUse this to personalize. Don't announce what you know — just be naturally helpful. Reference their history when relevant.`;
}

/**
 * Update user memory after a conversation exchange.
 * Asks the AI to decide what (if anything) to remember, then saves it.
 * Runs async — fire and forget.
 */
export async function updateUserMemory(
  userId: string,
  userMessage: string,
  aiReply: string,
  venueName?: string
): Promise<void> {
  // Skip very short messages and common commands
  if (userMessage.length < 10) return;
  const lower = userMessage.toLowerCase().trim();
  if (["menu", "vibe", "events", "reserve", "status", "hi", "hello", "hey", "thanks", "ok", "yes", "no", "sure", "cool"].includes(lower)) return;

  try {
    // Load current memory
    const { data: profile } = await supabase
      .from("profiles")
      .select("memory")
      .eq("id", userId)
      .single();

    const currentMemory = profile?.memory || "";

    const res = await fetch(`${process.env.OPENCLAW_GATEWAY_URL}/v1/responses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENCLAW_GATEWAY_TOKEN}`,
        "Content-Type": "application/json",
        "x-openclaw-agent-id": "memory-writer",
      },
      body: JSON.stringify({
        model: "openclaw",
        input: [
          "You manage a user's memory file for a place discovery app called theKickBack.",
          "Given the current memory and a new conversation, output the UPDATED memory.",
          "Be detailed and thorough. Max 2000 chars total.",
          "",
          "STRUCTURE the memory using these sections (use exactly these headers):",
          "",
          "## Identity",
          "Name, who they are, what they do, group they're part of",
          "",
          "## Preferences",
          "- Diet: allergies, restrictions, likes/dislikes",
          "- Drinks: favorite drinks, how they take their coffee, etc.",
          "- Food: favorite cuisines, go-to orders, comfort foods",
          "- Vibe: what atmosphere they prefer (quiet, loud, cozy, upscale)",
          "- Music: genres, artists, live music preferences",
          "- Time: when they usually go out (morning, evening, weekends)",
          "- Group: solo, couple, friends, large group",
          "",
          "## Places",
          "- Favorite spots they've mentioned or visited often",
          "- Places they want to try",
          "- Neighborhoods they like",
          "",
          "## Orders & Habits",
          "- Usual orders at specific places (e.g., 'cortado with oat milk at Anodyne')",
          "- Shopping patterns, membership interests",
          "- How often they visit, regularity",
          "",
          "## Notes",
          "- Anything else worth remembering: upcoming events they mentioned,",
          "  friends' names, birthday, special occasions, travel plans",
          "",
          "RULES:",
          "- Add new info from this conversation. Don't lose existing memories.",
          "- Be specific: 'likes oat milk lattes' is better than 'likes coffee'.",
          "- Include the place name when recording orders or experiences.",
          "- Track what they ordered, liked, disliked, or asked about.",
          "- Remove only if directly contradicted ('actually I'm not vegan anymore').",
          "- If nothing new worth remembering, return current memory unchanged.",
          "- Use bullet points. Keep each point on one line.",
          "- Return ONLY the memory content, no explanation or preamble.",
          "",
          currentMemory ? `Current memory:\n${currentMemory}\n` : "Current memory: (empty — this is the first entry)\n",
          `---`,
          `New conversation at: ${venueName || "KickBack concierge"}`,
          `Date: ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}`,
          `User: "${userMessage}"`,
          `AI: "${aiReply}"`,
          "",
          "Updated memory:",
        ].join("\n"),
      }),
    });

    if (!res.ok) return;

    const data = await res.json();
    const msg = data.output?.find((o: { type: string }) => o.type === "message");
    const text = msg?.content?.find((c: { type: string; text?: string }) => c.type === "output_text")?.text;
    if (!text) return;

    const newMemory = text.trim().slice(0, 2000);

    // Only update if actually changed
    if (newMemory && newMemory !== currentMemory) {
      await supabase
        .from("profiles")
        .update({ memory: newMemory })
        .eq("id", userId);
    }
  } catch (err) {
    console.error("Memory update error:", err);
  }
}
