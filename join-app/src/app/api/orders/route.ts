import { headers } from "next/headers";
import { createClient as createAuthClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { isSandboxServer } from "@/lib/sandbox";
import { sendEmail, wrap } from "@/lib/email";
import { sendPushToUser } from "@/lib/push";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function POST(request: Request) {
  // Verify authenticated user from session cookie
  const authClient = await createAuthClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const h = await headers();
  const mode = isSandboxServer(h) ? "test" : "live";

  const userId = user.id;
  const { venueId, items, addOns, pointsToSpend, notes } = await request.json();

  if (!venueId || !items || items.length === 0) {
    return Response.json({ error: "Missing venue or items" }, { status: 400 });
  }

  // Check if venue has Stripe connected — can't sell without it
  const accountCol = mode === "test" ? "stripe_test_account_id" : "stripe_account_id";
  const { data: venueStripe } = await supabase
    .from("venues")
    .select(accountCol)
    .eq("id", venueId)
    .single();

  if (!venueStripe || !(venueStripe as Record<string, unknown>)[accountCol]) {
    return Response.json({ error: "This place hasn't set up payments yet. Let them know!" }, { status: 400 });
  }

  // Validate: bookable offerings must include date+time in metadata
  for (const item of items) {
    if (!item.offering_id) continue;
    const { data: off } = await supabase
      .from("venue_offerings")
      .select("type, duration_minutes")
      .eq("id", item.offering_id)
      .single();

    if (off && (off.type === "reservation" || (off.duration_minutes && ["service", "event"].includes(off.type)))) {
      if (!item.metadata?.date || !item.metadata?.time) {
        return Response.json(
          { error: `"${item.name}" requires a date and time. Please book it through the scheduler.` },
          { status: 400 }
        );
      }
    }
  }

  // Merge add-ons into items array
  const allItems = [
    ...items,
    ...(addOns || []).map((a: { name: string; price_cents: number; offering_id?: string }) => ({
      offering_id: a.offering_id || null,
      slot_id: null,
      name: a.name,
      description: "Add-on",
      quantity: 1,
      unit_price_cents: a.price_cents,
      metadata: {},
    })),
  ];

  try {
    const { data, error } = await supabase.rpc("create_order", {
      p_user_id: userId,
      p_venue_id: venueId,
      p_items: allItems,
      p_points_to_spend: pointsToSpend || 0,
      p_notes: notes || null,
    });

    if (error) {
      console.error("[orders] FAILED:", error.message, error.code, JSON.stringify({ userId, venueId, itemCount: allItems.length }));
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.log("[orders] OK:", JSON.stringify({ orderId: data, userId, venueId, itemCount: allItems.length }));

    // Tag the order and its items with the current mode
    if (data) {
      await supabase.from("orders").update({ mode }).eq("id", data);
      await supabase.from("order_items").update({ mode }).eq("order_id", data);
    }

    // Grant purchase bonus points (10 pts per dollar spent)
    const totalCents = allItems.reduce(
      (sum: number, i: { unit_price_cents: number; quantity: number }) =>
        sum + i.unit_price_cents * (i.quantity || 1),
      0
    );
    const bonusPoints = Math.floor(totalCents / 10); // 10 pts per dollar

    if (bonusPoints > 0) {
      await supabase.rpc("grant_points", {
        p_user_id: userId,
        p_venue_id: venueId,
        p_amount: bonusPoints,
        p_reason: "purchase_bonus",
        p_reference_id: data,
      });
    }

    // ─── Insert pending fulfillments for wallet pass ─────────
    const { data: venueData } = await supabase.from("venues").select("name").eq("id", venueId).single();
    const vName = (venueData as any)?.name || "Venue";
    for (const item of allItems) {
      await supabase.from("pending_fulfillments").insert({
        user_id: userId,
        venue_id: venueId,
        type: "order",
        reference_id: String(data),
        label: `${item.name} @ ${vName}`,
      });
    }

    // ─── Send order receipt email ─────────────────────────────
    if (user.email) {
      try {
        const vName = venueData?.name || "Venue";
        const { data: venueExtra } = await supabase.from("venues").select("address, neighborhood").eq("id", venueId).single();
        const venueAddr = venueExtra?.address || "";
        const now = new Date();
        const dateStr = now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        const timeStr = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

        // Check if any item has a scheduled date/time
        const scheduledItem = allItems.find((i: { metadata?: { date?: string; time?: string } }) => i.metadata?.date && i.metadata?.time);
        const apptDate = scheduledItem?.metadata?.date || null;
        const apptTime = scheduledItem?.metadata?.time || null;
        const staffName = scheduledItem?.metadata?.staffName || null;

        const itemRows = allItems.map((i: { name: string; quantity: number; unit_price_cents: number; metadata?: { date?: string; time?: string; staffName?: string } }) =>
          `<tr>
            <td style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.7);font-size:13px;">
              ${i.name}${i.quantity > 1 ? ` x${i.quantity}` : ""}${i.metadata?.date ? `<br><span style="color:rgba(255,255,255,0.35);font-size:11px;">${i.metadata.date} at ${i.metadata.time || ""}${i.metadata.staffName ? ` with ${i.metadata.staffName}` : ""}</span>` : ""}
            </td>
            <td style="text-align:right;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:#fff;font-size:13px;">$${((i.unit_price_cents * (i.quantity || 1)) / 100).toFixed(2)}</td>
          </tr>`
        ).join("");
        const totalDollars = (totalCents / 100).toFixed(2);

        // Build ICS calendar link if scheduled
        let icsLink = "";
        if (apptDate && apptTime) {
          const match = apptTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
          if (match) {
            let h = parseInt(match[1]);
            const m = parseInt(match[2]);
            if (match[3].toUpperCase() === "PM" && h !== 12) h += 12;
            if (match[3].toUpperCase() === "AM" && h === 12) h = 0;
            // Parse date like "Today", "Tomorrow", "Tue 22" or "2026-03-22"
            let isoDate = apptDate;
            if (apptDate.toLowerCase() === "today") isoDate = new Date().toISOString().split("T")[0];
            else if (apptDate.toLowerCase() === "tomorrow") { const d = new Date(); d.setDate(d.getDate() + 1); isoDate = d.toISOString().split("T")[0]; }
            else if (apptDate.match(/^\d{4}-\d{2}-\d{2}$/)) isoDate = apptDate;
            const startDT = `${isoDate.replace(/-/g, "")}T${String(h).padStart(2, "0")}${String(m).padStart(2, "0")}00`;
            const dur = scheduledItem?.metadata?.duration || 30;
            const endH = h + Math.floor((m + dur) / 60);
            const endM = (m + dur) % 60;
            const endDT = `${isoDate.replace(/-/g, "")}T${String(endH).padStart(2, "0")}${String(endM).padStart(2, "0")}00`;
            const itemName = scheduledItem?.name || "Appointment";
            const gcalStart = startDT;
            const gcalEnd = endDT;
            const gcalTitle = encodeURIComponent(`${itemName} at ${vName}`);
            const gcalLocation = encodeURIComponent(venueAddr);
            const gcalDetails = encodeURIComponent(`${staffName ? `With ${staffName}. ` : ""}Booked via theKickBack.`);
            const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${gcalTitle}&dates=${gcalStart}/${gcalEnd}&location=${gcalLocation}&details=${gcalDetails}`;
            icsLink = `<a href="${gcalUrl}" target="_blank" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#8B5CF6;color:#fff;border-radius:10px;text-decoration:none;font-weight:700;font-size:13px;">Add to Calendar</a>`;
          }
        }

        const subjectLine = apptDate
          ? `${apptDate} at ${apptTime} — ${vName}`
          : `Order confirmed — ${vName}`;

        sendEmail(user.email, subjectLine, wrap(`
          <div style="text-align:center;margin-bottom:24px;">
            <h1 style="margin:0;font-size:24px;color:#fff;">${apptDate ? "You're booked" : "Order confirmed"}</h1>
            <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.5);">${vName}${venueAddr ? ` &middot; ${venueAddr}` : ""}</p>
            ${apptDate ? `<p style="margin:8px 0 0;font-size:16px;font-weight:700;color:#8B5CF6;">${apptDate} at ${apptTime}</p>` : `<p style="margin:4px 0 0;font-size:12px;color:rgba(255,255,255,0.3);">${dateStr} at ${timeStr}</p>`}
            ${staffName ? `<p style="margin:4px 0 0;font-size:12px;color:rgba(255,255,255,0.4);">with ${staffName}</p>` : ""}
          </div>
          <table style="width:100%;border-collapse:collapse;">
            ${itemRows}
            <tr>
              <td style="padding:10px 0;font-weight:700;color:#fff;font-size:14px;">Total</td>
              <td style="text-align:right;padding:10px 0;font-weight:700;color:#fff;font-size:14px;">$${totalDollars}</td>
            </tr>
          </table>
          ${bonusPoints > 0 ? `<div style="background:#111;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:12px 16px;margin-top:16px;text-align:center;">
            <span style="color:#F97316;font-weight:600;font-size:14px;">+${bonusPoints} XP earned</span>
          </div>` : ""}
          ${icsLink ? `<div style="text-align:center;margin-top:8px;">${icsLink}</div>` : ""}
        `));
      } catch (e) { console.error("Order receipt email failed:", e); }
    }

    // Memberships now go through Stripe Checkout (/api/membership/checkout)
    // and are handled by Stripe webhooks — no membership logic here.

    // Push notification for order confirmation
    const itemNames = items.map((i: { name?: string }) => i.name || "Item").join(", ");
    sendPushToUser(userId, {
      title: "Order confirmed",
      body: itemNames,
      url: "/",
      tag: "order",
    }).catch(() => {});

    return Response.json({ orderId: data });
  } catch (err) {
    console.error("Order creation failed:", err);
    return Response.json({ error: "Failed to create order" }, { status: 500 });
  }
}
