import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

/**
 * Load recent chat history for a user+venue (or concierge if venueId is null).
 * Returns a formatted string ready for prompt injection.
 */
export async function getRecentChatHistory(
  userId: string,
  venueId: string | null,
  limit: number = 10
): Promise<string> {
  // Find the thread
  let threadQuery = supabase
    .from("chat_threads")
    .select("id")
    .eq("user_id", userId);

  if (venueId) {
    threadQuery = threadQuery.eq("venue_id", venueId);
  } else {
    threadQuery = threadQuery.is("venue_id", null);
  }

  const { data: threads } = await threadQuery.limit(1);
  const thread = threads?.[0];
  if (!thread) return "";

  // Get recent messages (oldest first for natural reading order)
  const { data: messages } = await supabase
    .from("chat_messages")
    .select("sender_type, body, created_at")
    .eq("thread_id", thread.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!messages || messages.length === 0) return "";

  // Reverse to chronological order
  const ordered = messages.reverse();

  const lines = ordered.map((m) => {
    const sender = m.sender_type === "guest" ? "Guest" : "You";
    return `${sender}: ${m.body}`;
  });

  return [
    "\nRecent conversation history with this guest:",
    ...lines,
    "\nUse this history for continuity. Don't repeat yourself. Build on past context naturally.",
  ].join("\n");
}
