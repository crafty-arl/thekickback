import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

const service = createServiceClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const CF_ACCOUNT_ID = "6c235bb622d4bca66876392df398234b";
const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN || "";

export async function POST(request: Request) {
  // Auth
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("receipt") as File | null;
  const venueId = formData.get("venueId") as string;
  const checkinId = formData.get("checkinId") as string;
  const venueName = formData.get("venueName") as string;

  if (!file || !venueId || !checkinId) {
    return Response.json({ error: "Missing receipt, venueId, or checkinId" }, { status: 400 });
  }

  // Convert image to base64
  const bytes = await file.arrayBuffer();
  const base64 = Buffer.from(bytes).toString("base64");

  // Analyze receipt with Cloudflare Workers AI (vision model)
  let totalCents = 0;
  let items: string[] = [];
  let isValid = false;

  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run/@cf/meta/llama-3.2-11b-vision-instruct`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${CF_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Analyze this receipt image. Extract:
1. The total amount paid (as a number in cents, e.g. 1550 for $15.50)
2. A list of item names purchased (short names only, no prices)
3. Whether this looks like a legitimate receipt from "${venueName}" (true/false)

Respond in EXACTLY this JSON format, nothing else:
{"total_cents": 1550, "items": ["Latte", "Croissant"], "is_valid": true}

If you cannot read the receipt, respond: {"total_cents": 0, "items": [], "is_valid": false}`,
                },
                {
                  type: "image_url",
                  image_url: { url: `data:image/jpeg;base64,${base64}` },
                },
              ],
            },
          ],
          max_tokens: 200,
        }),
      }
    );

    if (res.ok) {
      const data = await res.json();
      const text = data.result?.response || "";
      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        totalCents = parsed.total_cents || 0;
        items = parsed.items || [];
        isValid = parsed.is_valid === true;
      }
    }
  } catch (err) {
    console.error("Receipt analysis error:", err);
  }

  if (!isValid || totalCents === 0) {
    // Update checkin with rejection
    await service
      .from("checkins")
      .update({ receipt_status: "rejected", receipt_total_cents: 0, receipt_items: [] })
      .eq("id", checkinId);

    return Response.json({
      error: "Could not verify receipt. Make sure the photo is clear and shows the full receipt.",
      total_cents: 0,
      items: [],
      xp_awarded: 0,
      status: "rejected",
    });
  }

  // Calculate purchase XP based on venue's order action
  const { data: orderAction } = await service
    .from("venue_xp_actions")
    .select("points")
    .eq("venue_id", venueId)
    .eq("action", "order")
    .eq("active", true)
    .single();

  // XP = base order points per $10 spent (minimum 1x)
  const basePoints = orderAction?.points || 25;
  const spendMultiplier = Math.max(1, Math.floor(totalCents / 1000));
  const xpAmount = basePoints * spendMultiplier;

  // Grant purchase XP
  let xpResult = { xp: 0 };
  try {
    const { data } = await service.rpc("grant_venue_xp", {
      p_user_id: user.id,
      p_venue_id: venueId,
      p_action: "order",
      p_amount: xpAmount,
    });
    if (data) xpResult = data;
  } catch (err) {
    console.error("Receipt XP grant error:", err);
  }

  // Update checkin with receipt data
  await service
    .from("checkins")
    .update({
      receipt_total_cents: totalCents,
      receipt_items: items,
      receipt_xp_granted: xpResult.xp || xpAmount,
      receipt_status: "verified",
    })
    .eq("id", checkinId);

  return Response.json({
    total_cents: totalCents,
    items,
    xp_awarded: xpResult.xp || xpAmount,
    status: "verified",
  });
}
