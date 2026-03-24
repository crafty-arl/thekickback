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

  return `\nWhat you know about this guest (from past conversations):\n${data.memory}\nUse this to personalize. Don't announce what you know — just be naturally helpful.`;
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
  // Skip short messages and commands
  if (userMessage.length < 15) return;
  const lower = userMessage.toLowerCase().trim();
  if (["menu", "vibe", "events", "reserve", "status", "hi", "hello", "hey", "thanks", "ok", "yes", "no"].includes(lower)) return;

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
          "You manage a user's memory file for a venue discovery app.",
          "Given the current memory and a new conversation, output the UPDATED memory.",
          "Keep it concise — bullet points, no fluff. Max 500 chars total.",
          "",
          "Rules:",
          "- Only add things the user explicitly said or strongly implied about themselves.",
          "- Remove duplicates. Merge related info.",
          "- Keep dietary needs, drink/food preferences, favorite venues, vibes they like, group size, usual orders.",
          "- Drop anything stale or irrelevant.",
          "- If nothing worth remembering, return the current memory unchanged.",
          "- Return ONLY the memory content, no explanation.",
          "",
          currentMemory ? `Current memory:\n${currentMemory}\n` : "Current memory: (empty)\n",
          `At venue: ${venueName || "concierge"}`,
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

    const newMemory = text.trim().slice(0, 500);

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
