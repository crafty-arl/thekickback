import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createAuthClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

function getService() {
  return createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );
}

// ─── Types ──────────────────────────────────────────────────────

interface RequestBody {
  message: string;
  venueId: string;
  action?: {
    type: string;
    id?: string;
    data?: Record<string, unknown>;
  };
}

interface ActionResult {
  success: boolean;
  message: string;
}

// ─── Auth helper ────────────────────────────────────────────────

async function getOwnerVenueId(): Promise<string | null> {
  const supabase = await createAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await getService()
    .from("venue_owners")
    .select("venue_id, role")
    .eq("user_id", user.id)
    .eq("role", "owner")
    .limit(1)
    .single();

  return data?.venue_id || null;
}

// ─── Action handler ─────────────────────────────────────────────

async function handleAction(
  action: NonNullable<RequestBody["action"]>,
  venueId: string,
): Promise<{ reply: string; actionResult: ActionResult }> {
  const svc = getService();
  try {
    switch (action.type) {
      case "approve_booking": {
        if (!action.id) throw new Error("Missing booking id");
        const { error } = await svc
          .from("venue_bookings")
          .update({ cal_status: "accepted" })
          .eq("id", action.id);
        if (error) throw new Error(error.message);
        revalidatePath("/");
        return {
          reply: `Done -- booking approved. [[ACTION_CONFIRM:{"success":true,"message":"Booking approved"}]]`,
          actionResult: { success: true, message: "Booking approved" },
        };
      }

      case "decline_booking": {
        if (!action.id) throw new Error("Missing booking id");
        const { error } = await svc
          .from("venue_bookings")
          .update({ cal_status: "cancelled" })
          .eq("id", action.id);
        if (error) throw new Error(error.message);
        revalidatePath("/");
        return {
          reply: `Done -- booking declined. [[ACTION_CONFIRM:{"success":true,"message":"Booking declined"}]]`,
          actionResult: { success: true, message: "Booking declined" },
        };
      }

      case "add_offering": {
        if (!action.data) throw new Error("Missing offering data");
        const d = action.data as { name: string; type: string; description?: string; price_cents: number; recurring?: boolean; interval?: string; perks?: string[]; duration_minutes?: number; capacity?: number; add_ons?: { name: string; price_cents: number }[] };
        const { error } = await svc.from("venue_offerings").insert({
          venue_id: venueId,
          name: (d.name || "").trim(),
          type: d.type || "custom",
          description: d.description?.trim() || null,
          price_cents: d.price_cents || 0,
          recurring: d.recurring || false,
          interval: d.recurring ? (d.interval || "month") : null,
          perks: d.perks || [],
          duration_minutes: d.duration_minutes || null,
          capacity: d.capacity || null,
          add_ons: d.add_ons || [],
        });
        if (error) throw new Error(error.message);
        revalidatePath("/settings");
        return {
          reply: `Done -- offering created. [[ACTION_CONFIRM:{"success":true,"message":"Offering added"}]]`,
          actionResult: { success: true, message: "Offering added" },
        };
      }

      case "update_offering": {
        if (!action.id) throw new Error("Missing offering id");
        if (!action.data) throw new Error("Missing offering data");
        const { error } = await svc
          .from("venue_offerings")
          .update(action.data)
          .eq("id", action.id)
          .eq("venue_id", venueId);
        if (error) throw new Error(error.message);
        revalidatePath("/settings");
        return {
          reply: `Done -- offering updated. [[ACTION_CONFIRM:{"success":true,"message":"Offering updated"}]]`,
          actionResult: { success: true, message: "Offering updated" },
        };
      }

      case "delete_offering": {
        if (!action.id) throw new Error("Missing offering id");
        const { error } = await svc
          .from("venue_offerings")
          .delete()
          .eq("id", action.id)
          .eq("venue_id", venueId);
        if (error) throw new Error(error.message);
        revalidatePath("/settings");
        return {
          reply: `Done -- offering deleted. [[ACTION_CONFIRM:{"success":true,"message":"Offering deleted"}]]`,
          actionResult: { success: true, message: "Offering deleted" },
        };
      }

      case "add_knowledge": {
        if (!action.data?.content) throw new Error("Missing content");
        const { error } = await svc.from("venue_knowledge").insert({
          venue_id: venueId,
          content: (action.data.content as string).trim(),
          category: (action.data.category as string) || "general",
        });
        if (error) throw new Error(error.message);
        revalidatePath("/settings");
        return {
          reply: `Done -- knowledge added. [[ACTION_CONFIRM:{"success":true,"message":"Knowledge entry added"}]]`,
          actionResult: { success: true, message: "Knowledge entry added" },
        };
      }

      case "delete_knowledge": {
        if (!action.id) throw new Error("Missing knowledge id");
        const { error } = await svc
          .from("venue_knowledge")
          .delete()
          .eq("id", action.id)
          .eq("venue_id", venueId);
        if (error) throw new Error(error.message);
        revalidatePath("/settings");
        return {
          reply: `Done -- knowledge entry removed. [[ACTION_CONFIRM:{"success":true,"message":"Knowledge entry deleted"}]]`,
          actionResult: { success: true, message: "Knowledge entry deleted" },
        };
      }

      case "add_menu_item": {
        if (!action.data) throw new Error("Missing menu item data");
        const mi = action.data as { category: string; name: string; description?: string; price_cents: number; inventory_count?: number };
        const { error } = await svc.from("venue_menu_items").insert({
          venue_id: venueId,
          category: mi.category || "General",
          name: (mi.name || "").trim(),
          description: mi.description?.trim() || null,
          price_cents: mi.price_cents || 0,
          inventory_count: mi.inventory_count ?? null,
          in_stock: true,
        });
        if (error) throw new Error(error.message);
        revalidatePath("/settings");
        return {
          reply: `Done -- menu item added. [[ACTION_CONFIRM:{"success":true,"message":"Menu item added"}]]`,
          actionResult: { success: true, message: "Menu item added" },
        };
      }

      default:
        return {
          reply: `Unknown action type: ${action.type}. [[ACTION_CONFIRM:{"success":false,"message":"Unknown action"}]]`,
          actionResult: { success: false, message: "Unknown action type" },
        };
    }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Action failed";
    return {
      reply: `Error: ${message}. [[ACTION_CONFIRM:{"success":false,"message":"${message}"}]]`,
      actionResult: { success: false, message },
    };
  }
}

// ─── POST handler ───────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const ownerVenueId = await getOwnerVenueId();
    if (!ownerVenueId) {
      return NextResponse.json(
        { error: "Not authenticated or not an owner" },
        { status: 401 },
      );
    }

    const body: RequestBody = await request.json();
    const { message, venueId, action } = body;

    if (!message || !venueId) {
      return NextResponse.json(
        { error: "message and venueId are required" },
        { status: 400 },
      );
    }

    if (ownerVenueId !== venueId) {
      return NextResponse.json(
        { error: "Not authorized for this venue" },
        { status: 403 },
      );
    }

    // ─── Action confirmation step ─────────────────────────────
    if (action) {
      const result = await handleAction(action, venueId);
      return NextResponse.json(result);
    }

    // ─── Regular chat: fetch live context ─────────────────────

    const svc = getService();
    const [venueRes, bookingsRes, sessionsRes, offeringsRes, knowledgeRes] =
      await Promise.all([
        svc
          .from("venues")
          .select("name, current_occupancy, max_occupancy")
          .eq("id", venueId)
          .single(),
        svc
          .from("venue_bookings")
          .select("id, guest_name, offering_name, starts_at, cal_status")
          .eq("venue_id", venueId)
          .eq("cal_status", "pending")
          .order("starts_at", { ascending: true }),
        svc
          .from("sessions")
          .select("id, user_id, started_at, status, profiles(display_name, phone)")
          .eq("venue_id", venueId)
          .eq("status", "active"),
        svc
          .from("venue_offerings")
          .select("id, name, type, price_cents, active")
          .eq("venue_id", venueId)
          .eq("active", true),
        svc
          .from("venue_knowledge")
          .select("category")
          .eq("venue_id", venueId),
      ]);

    const venue = venueRes.data;
    const venueName = venue?.name || "your venue";
    const occupancy = venue?.current_occupancy ?? 0;
    const capacity = venue?.max_occupancy ?? 0;

    const pendingBookings = bookingsRes.data || [];
    const sessions = sessionsRes.data || [];
    const offerings = offeringsRes.data || [];
    const knowledgeEntries = knowledgeRes.data || [];

    // Group knowledge by category
    const knowledgeCounts: Record<string, number> = {};
    for (const entry of knowledgeEntries) {
      const cat = (entry as { category: string }).category || "general";
      knowledgeCounts[cat] = (knowledgeCounts[cat] || 0) + 1;
    }
    const knowledgeCategories = Object.entries(knowledgeCounts)
      .map(([cat, count]) => `${cat} (${count})`)
      .join(", ") || "none";

    // ─── Build system prompt ──────────────────────────────────

    const systemPrompt = `You are the AI operations agent for "${venueName}". You help the owner manage their venue through conversation.

LIVE DATA:
- Occupancy: ${occupancy}/${capacity}
- Active sessions: ${sessions.length} guests checked in
- Pending bookings: ${pendingBookings.length}
${pendingBookings.map((b: { guest_name: string; offering_name: string; starts_at: string }) => `  - ${b.guest_name}: ${b.offering_name} at ${new Date(b.starts_at).toLocaleString()}`).join("\n")}
- Active offerings: ${offerings.length}
${offerings.map((o: { type: string; name: string; price_cents: number; id: string }) => `  - [${o.type}] "${o.name}" $${(o.price_cents / 100).toFixed(2)} (id:${o.id})`).join("\n")}
- Knowledge base: ${knowledgeCategories}

RESPONSE FORMAT:
Include data cards in your responses using these tags:
- [[STATS:{"occupancy":N,"capacity":N,"visitorsToday":N,"revenue":N,"members":N}]] -- stats overview
- [[BOOKINGS:[{"id":"...","guest_name":"...","offering_name":"...","starts_at":"...","cal_status":"..."}]]] -- booking list
- [[GUESTS:[{"id":"...","display_name":"...","tier":"...","venue_xp":N,"started_at":"..."}]]] -- active guests
- [[REVENUE:{"today":N,"thisWeek":N,"pendingPayouts":N}]] -- revenue (amounts in cents)
- [[ACTION_CONFIRM:{"success":true,"message":"..."}]] -- after completing an action
- [[LINK:/settings#section]] -- link to settings section

WRITE ACTIONS:
When the owner wants to create, update, or delete something, describe what you'll do and ask for confirmation.
Do NOT auto-execute destructive actions.

Keep responses concise. No emojis. Be direct and operational.`;

    // ─── Call OpenClaw ────────────────────────────────────────

    let reply =
      "Could not reach the AI agent right now. Try again in a moment.";

    try {
      const res = await fetch(
        `${process.env.OPENCLAW_GATEWAY_URL}/v1/responses`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.OPENCLAW_GATEWAY_TOKEN}`,
            "Content-Type": "application/json",
            "x-openclaw-agent-id": `owner-${venueId}`,
          },
          body: JSON.stringify({
            model: "openclaw",
            input: `${systemPrompt}\n\nOwner says: "${message}"`,
          }),
        },
      );

      if (res.ok) {
        const data = await res.json();
        const msg = data.output?.find(
          (o: { type: string }) => o.type === "message",
        );
        const text = msg?.content?.find(
          (c: { type: string; text?: string }) => c.type === "output_text",
        )?.text;
        if (text) {
          reply = text;
        }
      } else {
        console.error("OpenClaw error:", res.status, await res.text());
      }
    } catch (err) {
      console.error("OpenClaw fetch error:", err);
    }

    return NextResponse.json({ reply });
  } catch (err) {
    console.error("Owner chat error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
