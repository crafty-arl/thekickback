import { NextRequest, NextResponse } from "next/server";
import { createClient as createAuthClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// GET /api/threads — list all threads for the authenticated user
// GET /api/threads?venueId=xxx — get message history for a specific venue thread
export async function GET(req: NextRequest) {
  const authClient = await createAuthClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const venueId = req.nextUrl.searchParams.get("venueId");
  const isMaster = req.nextUrl.searchParams.get("master") === "true";
  const limit = parseInt(req.nextUrl.searchParams.get("limit") || "30");
  const offset = parseInt(req.nextUrl.searchParams.get("offset") || "0");

  // If venueId or master specified, return message history
  if (venueId || isMaster) {
    // Find the thread
    let threadQuery = supabase
      .from("chat_threads")
      .select("id")
      .eq("user_id", user.id);

    if (isMaster) {
      threadQuery = threadQuery.is("venue_id", null);
    } else {
      threadQuery = threadQuery.eq("venue_id", venueId!);
    }

    const { data: threads } = await threadQuery.limit(1);
    const thread = threads?.[0];

    if (!thread) {
      return NextResponse.json({ messages: [], threadId: null });
    }

    // Get messages
    const { data: messages } = await supabase
      .from("chat_messages")
      .select("id, sender_type, body, created_at")
      .eq("thread_id", thread.id)
      .order("created_at", { ascending: true })
      .range(offset, offset + limit - 1);

    // Mark as read
    await supabase
      .from("chat_threads")
      .update({ unread: false })
      .eq("id", thread.id);

    return NextResponse.json({
      messages: messages || [],
      threadId: thread.id,
    });
  }

  // No venueId — return all threads (thread list)
  const { data: threads } = await supabase
    .from("chat_threads")
    .select(`
      id, venue_id, thread_type, last_message, last_message_at,
      message_count, unread,
      venues (id, name, vibe, occupancy, max_occupancy, type, neighborhood)
    `)
    .eq("user_id", user.id)
    .order("last_message_at", { ascending: false })
    .limit(50);

  // Flatten venues join
  const threadList = (threads || []).map((t: Record<string, unknown>) => {
    const venue = Array.isArray(t.venues) ? t.venues[0] : t.venues;
    return {
      id: t.id,
      venueId: t.venue_id,
      threadType: t.thread_type,
      lastMessage: t.last_message,
      lastMessageAt: t.last_message_at,
      messageCount: t.message_count,
      unread: t.unread,
      venue: venue ? {
        id: (venue as Record<string, unknown>).id,
        name: (venue as Record<string, unknown>).name,
        vibe: (venue as Record<string, unknown>).vibe,
        occupancy: (venue as Record<string, unknown>).occupancy,
        capacity: (venue as Record<string, unknown>).max_occupancy,
        type: (venue as Record<string, unknown>).type,
        neighborhood: (venue as Record<string, unknown>).neighborhood,
      } : null,
    };
  });

  // Count total unread
  const unreadCount = threadList.filter((t) => t.unread).length;

  return NextResponse.json({ threads: threadList, unreadCount });
}
