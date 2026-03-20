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

      case "delete_menu_item": {
        if (!action.id) throw new Error("Missing menu item id");
        const { error } = await svc
          .from("venue_menu_items")
          .delete()
          .eq("id", action.id)
          .eq("venue_id", venueId);
        if (error) throw new Error(error.message);
        revalidatePath("/settings");
        return {
          reply: `Done -- menu item removed. [[ACTION_CONFIRM:{"success":true,"message":"Menu item deleted"}]]`,
          actionResult: { success: true, message: "Menu item deleted" },
        };
      }

      case "toggle_menu_stock": {
        if (!action.id) throw new Error("Missing menu item id");
        const inStock = action.data?.in_stock !== false;
        const { error } = await svc
          .from("venue_menu_items")
          .update({ in_stock: inStock })
          .eq("id", action.id)
          .eq("venue_id", venueId);
        if (error) throw new Error(error.message);
        revalidatePath("/settings");
        return {
          reply: `Done -- item marked ${inStock ? "in stock" : "out of stock"}. [[ACTION_CONFIRM:{"success":true,"message":"Stock updated"}]]`,
          actionResult: { success: true, message: "Stock updated" },
        };
      }

      case "update_venue": {
        if (!action.data) throw new Error("Missing venue data");
        const vd = action.data as { name?: string; type?: string; address?: string; neighborhood?: string; max_occupancy?: number; vibe?: string; rules?: string[] };
        // Geocode if address changed
        if (vd.address) {
          try {
            const geoRes = await fetch(
              `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(vd.address)}&format=json&limit=1`,
              { headers: { "User-Agent": "theKickBack/1.0" } }
            );
            if (geoRes.ok) {
              const geo = await geoRes.json() as { lat: string; lon: string; display_name: string }[];
              if (geo.length > 0) {
                (vd as Record<string, unknown>).lat = parseFloat(geo[0].lat);
                (vd as Record<string, unknown>).lng = parseFloat(geo[0].lon);
                const parts = geo[0].display_name.split(",");
                vd.neighborhood = parts.length > 1 ? parts[1].trim() : vd.neighborhood;
              }
            }
          } catch { /* best effort */ }
        }
        const { error } = await svc.from("venues").update(vd).eq("id", venueId);
        if (error) throw new Error(error.message);
        revalidatePath("/");
        revalidatePath("/settings");
        const fields = Object.keys(vd).join(", ");
        return {
          reply: `Done -- updated ${fields}. [[ACTION_CONFIRM:{"success":true,"message":"Venue updated"}]]`,
          actionResult: { success: true, message: "Venue updated" },
        };
      }

      case "update_page": {
        if (!action.data) throw new Error("Missing page data");
        const { error } = await svc.from("venue_pages").update(action.data).eq("venue_id", venueId);
        if (error) throw new Error(error.message);
        revalidatePath("/");
        revalidatePath("/settings");
        const fields = Object.keys(action.data).join(", ");
        return {
          reply: `Done -- updated ${fields}. [[ACTION_CONFIRM:{"success":true,"message":"Page updated"}]]`,
          actionResult: { success: true, message: "Page updated" },
        };
      }

      case "add_xp_action": {
        if (!action.data) throw new Error("Missing XP action data");
        const xa = action.data as { action: string; label: string; points: number; description?: string; max_per_day?: number };
        const { error } = await svc.from("venue_xp_actions").insert({
          venue_id: venueId,
          action: xa.action,
          label: xa.label,
          points: xa.points,
          description: xa.description || null,
          max_per_day: xa.max_per_day || null,
        });
        if (error) throw new Error(error.message);
        revalidatePath("/settings");
        return {
          reply: `Done -- XP action "${xa.label}" (+${xa.points} pts) created. [[ACTION_CONFIRM:{"success":true,"message":"XP action added"}]]`,
          actionResult: { success: true, message: "XP action added" },
        };
      }

      case "delete_xp_action": {
        if (!action.id) throw new Error("Missing XP action id");
        const { error } = await svc.from("venue_xp_actions").delete().eq("id", action.id).eq("venue_id", venueId);
        if (error) throw new Error(error.message);
        revalidatePath("/settings");
        return {
          reply: `Done -- XP action removed. [[ACTION_CONFIRM:{"success":true,"message":"XP action deleted"}]]`,
          actionResult: { success: true, message: "XP action deleted" },
        };
      }

      case "add_xp_milestone": {
        if (!action.data) throw new Error("Missing milestone data");
        const xm = action.data as { name: string; threshold: number; color: string; reward?: string; perks?: string[] };
        const { error } = await svc.from("venue_xp_milestones").insert({
          venue_id: venueId,
          name: xm.name,
          threshold: xm.threshold,
          color: xm.color,
          reward: xm.reward || null,
          perks: xm.perks || [],
        });
        if (error) throw new Error(error.message);
        revalidatePath("/settings");
        return {
          reply: `Done -- milestone "${xm.name}" at ${xm.threshold} XP created. [[ACTION_CONFIRM:{"success":true,"message":"Milestone added"}]]`,
          actionResult: { success: true, message: "Milestone added" },
        };
      }

      case "delete_xp_milestone": {
        if (!action.id) throw new Error("Missing milestone id");
        const { error } = await svc.from("venue_xp_milestones").delete().eq("id", action.id).eq("venue_id", venueId);
        if (error) throw new Error(error.message);
        revalidatePath("/settings");
        return {
          reply: `Done -- milestone removed. [[ACTION_CONFIRM:{"success":true,"message":"Milestone deleted"}]]`,
          actionResult: { success: true, message: "Milestone deleted" },
        };
      }

      case "update_ai_limits": {
        if (!action.data) throw new Error("Missing AI limits data");
        const al = action.data as { free_messages_per_day: number; require_membership: boolean; gate_message: string };
        const { error } = await svc.from("venue_ai_limits").upsert({
          venue_id: venueId,
          free_messages_per_day: al.free_messages_per_day,
          require_membership: al.require_membership,
          gate_message: al.gate_message,
          updated_at: new Date().toISOString(),
        }, { onConflict: "venue_id" });
        if (error) throw new Error(error.message);
        revalidatePath("/settings");
        return {
          reply: `Done -- AI limits updated (${al.free_messages_per_day} msgs/day, membership ${al.require_membership ? "required" : "not required"}). [[ACTION_CONFIRM:{"success":true,"message":"AI limits updated"}]]`,
          actionResult: { success: true, message: "AI limits updated" },
        };
      }

      case "add_multiplier": {
        if (!action.data) throw new Error("Missing multiplier data");
        const mul = action.data as { multiplier: number; reason: string; starts_at: string; ends_at: string };
        const { error } = await svc.from("venue_multipliers").insert({
          venue_id: venueId,
          multiplier: mul.multiplier,
          reason: mul.reason,
          starts_at: mul.starts_at,
          ends_at: mul.ends_at,
          active: true,
        });
        if (error) throw new Error(error.message);
        revalidatePath("/settings");
        return {
          reply: `Done -- ${mul.multiplier}x multiplier activated for "${mul.reason}". [[ACTION_CONFIRM:{"success":true,"message":"Multiplier added"}]]`,
          actionResult: { success: true, message: "Multiplier added" },
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
    const [venueRes, pageRes, bookingsRes, sessionsRes, offeringsRes, knowledgeRes, xpActionsRes, xpMilestonesRes, aiLimitsRes, membersRes, multipliersRes] =
      await Promise.all([
        svc.from("venues").select("name, type, address, neighborhood, max_occupancy, occupancy, vibe, rules").eq("id", venueId).single(),
        svc.from("venue_pages").select("tagline, description, theme_color, hours, slug").eq("venue_id", venueId).single(),
        svc.from("venue_bookings").select("id, guest_name, offering_name, starts_at, cal_status").eq("venue_id", venueId).eq("cal_status", "pending").order("starts_at", { ascending: true }),
        svc.from("sessions").select("id, user_id, started_at, status, profiles(display_name, phone)").eq("venue_id", venueId).eq("status", "active"),
        svc.from("venue_offerings").select("id, name, type, price_cents, active, recurring, interval, duration_minutes").eq("venue_id", venueId).eq("active", true),
        svc.from("venue_knowledge").select("id, content, category").eq("venue_id", venueId),
        svc.from("venue_xp_actions").select("id, action, label, points, max_per_day, active").eq("venue_id", venueId),
        svc.from("venue_xp_milestones").select("id, name, threshold, color, reward").eq("venue_id", venueId).order("threshold", { ascending: true }),
        svc.from("venue_ai_limits").select("free_messages_per_day, require_membership, gate_message").eq("venue_id", venueId).maybeSingle(),
        svc.from("memberships").select("id", { count: "exact", head: true }).eq("venue_id", venueId),
        svc.from("venue_multipliers").select("id, multiplier, reason, starts_at, ends_at").eq("venue_id", venueId).eq("active", true),
      ]);

    const venue = venueRes.data;
    const venuePage = pageRes.data;
    const venueName = venue?.name || "your venue";
    const occupancy = venue?.occupancy ?? 0;
    const capacity = venue?.max_occupancy ?? 0;

    const pendingBookings = bookingsRes.data || [];
    const sessions = sessionsRes.data || [];
    const offerings = offeringsRes.data || [];
    const knowledgeEntries = knowledgeRes.data || [];
    const xpActions = xpActionsRes.data || [];
    const xpMilestones = xpMilestonesRes.data || [];
    const aiLimits = aiLimitsRes.data;
    const memberCount = membersRes.count || 0;
    const multipliers = multipliersRes.data || [];

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

    const systemPrompt = `You are the AI operations agent for "${venueName}". The owner is talking to you to manage their venue. Only venue owners can access this chat — every request here is authorized.

CURRENT VENUE CONFIG:
- Name: ${venue?.name || "?"} | Type: ${venue?.type || "?"} | Vibe: ${venue?.vibe || "?"}
- Address: ${venue?.address || "not set"} | Neighborhood: ${venue?.neighborhood || "?"}
- Capacity: ${capacity} | Current occupancy: ${occupancy}
- Rules: ${(venue?.rules || []).join(", ") || "none set"}
- Tagline: ${venuePage?.tagline || "not set"}
- Description: ${venuePage?.description || "not set"}
- Theme color: ${venuePage?.theme_color || "#F97316"}
- Hours: ${venuePage?.hours ? JSON.stringify(venuePage.hours) : "not set"}
- Public page: ${venuePage?.slug ? `join.thekickback.net/${venuePage.slug}` : "not published"}

LIVE DATA:
- Occupancy: ${occupancy}/${capacity}
- Active sessions: ${sessions.length} guests checked in
- Members: ${memberCount}
- Pending bookings: ${pendingBookings.length}
${pendingBookings.map((b: { guest_name: string; offering_name: string; starts_at: string }) => `  - ${b.guest_name}: ${b.offering_name} at ${new Date(b.starts_at).toLocaleString()}`).join("\n")}
- Active offerings: ${offerings.length}
${offerings.map((o: { type: string; name: string; price_cents: number; id: string; recurring?: boolean; interval?: string; duration_minutes?: number }) => `  - [${o.type}] "${o.name}" $${(o.price_cents / 100).toFixed(2)}${o.recurring ? `/${o.interval || "mo"}` : ""}${o.duration_minutes ? ` (${o.duration_minutes}min)` : ""} (id:${o.id})`).join("\n")}
- Knowledge base: ${knowledgeCategories}
${knowledgeEntries.length > 0 ? knowledgeEntries.map((k: { id: string; content: string; category: string }) => `  - [${k.category}] "${k.content.slice(0, 80)}${k.content.length > 80 ? "..." : ""}" (id:${k.id})`).join("\n") : ""}
- XP actions: ${xpActions.length > 0 ? xpActions.map((a: { label: string; points: number; id: string }) => `"${a.label}" +${a.points}pts (id:${a.id})`).join(", ") : "none"}
- XP milestones: ${xpMilestones.length > 0 ? xpMilestones.map((m: { name: string; threshold: number; id: string }) => `"${m.name}" at ${m.threshold}XP (id:${m.id})`).join(", ") : "none"}
- AI limits: ${aiLimits ? `${aiLimits.free_messages_per_day} msgs/day, membership ${aiLimits.require_membership ? "required" : "not required"}` : "no limits set"}
- Active multipliers: ${multipliers.length > 0 ? multipliers.map((m: { multiplier: number; reason: string }) => `${m.multiplier}x "${m.reason}"`).join(", ") : "none"}

RESPONSE FORMAT — include data cards using these tags:
- [[STATS:{"occupancy":N,"capacity":N,"visitorsToday":N,"revenue":N,"members":N}]]
- [[BOOKINGS:[{"id":"...","guest_name":"...","offering_name":"...","starts_at":"...","cal_status":"..."}]]]
- [[GUESTS:[{"id":"...","display_name":"...","tier":"...","venue_xp":N,"started_at":"..."}]]]
- [[REVENUE:{"today":N,"thisWeek":N,"pendingPayouts":N}]]
- [[ACTION_CONFIRM:{"success":true,"message":"..."}]]
- [[LINK:/settings#section]]

WRITE ACTIONS — you can execute these when the owner asks:
| Action | What it does |
|--------|-------------|
| update_venue | Change name, type, address, capacity, vibe, rules |
| update_page | Change tagline, description, theme_color, hours, slug |
| add_offering | Create a product, service, event, membership, reservation, or package |
| update_offering | Change an offering's name, description, price, perks |
| delete_offering | Remove an offering |
| add_knowledge | Add venue knowledge (menu info, hours, FAQ, events, etc.) |
| delete_knowledge | Remove a knowledge entry |
| add_menu_item | Add a menu item with category, price |
| delete_menu_item | Remove a menu item |
| toggle_menu_stock | Mark a menu item in/out of stock |
| add_xp_action | Create a loyalty action (e.g. "check_in" +50pts) |
| delete_xp_action | Remove an XP action |
| add_xp_milestone | Create a loyalty milestone (e.g. "Regular" at 500XP) |
| delete_xp_milestone | Remove a milestone |
| update_ai_limits | Set daily message limits and membership gates |
| add_multiplier | Activate a points multiplier (e.g. 2x for happy hour) |
| approve_booking | Accept a pending booking |
| decline_booking | Decline a pending booking |

BEHAVIOR:
- When the owner asks to change something, propose the specific action and ask for confirmation.
- For simple reads (stats, bookings, guest list), respond immediately with the data card.
- When the owner asks about something you can change, tell them what the current value is and offer to update it.
- For complex bulk edits or photo uploads, tell the owner those require the settings page.
- Keep responses concise. No emojis. Be direct and operational.`;

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
