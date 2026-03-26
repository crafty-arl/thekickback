import { NextRequest, NextResponse } from "next/server";
import { createClient as createAuthClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail, wrap } from "@/lib/email";
import { sendPushToUser } from "@/lib/push";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// POST /api/perks/redeem — redeem a venue perk using points
// Body: { perkId }
export async function POST(req: NextRequest) {
  const authClient = await createAuthClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { perkId } = await req.json();
  if (!perkId) return NextResponse.json({ error: "Missing perkId" }, { status: 400 });

  // Call the DB function to atomically redeem
  const { data: redemptionId, error } = await supabase.rpc("redeem_perk", {
    p_user_id: user.id,
    p_perk_id: perkId,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Fetch redemption details for the email
  const [
    { data: redemption },
    { data: perk },
    { data: balance },
  ] = await Promise.all([
    supabase.from("perk_redemptions").select("id, points_spent, expires_at, venue_id").eq("id", redemptionId).single(),
    supabase.from("venue_perks").select("name, category, point_cost").eq("id", perkId).single(),
    supabase.from("point_balances").select("balance").eq("user_id", user.id).single(),
  ]);

  // ─── Insert pending fulfillment for wallet pass ──────────────
  if (redemption && perk) {
    const { data: venue } = await supabase.from("venues").select("name").eq("id", redemption.venue_id).single();
    await supabase.from("pending_fulfillments").insert({
      user_id: user.id,
      venue_id: redemption.venue_id,
      type: "redemption",
      reference_id: String(redemptionId),
      label: `${perk.name} @ ${venue?.name || "Venue"}`,
    });
  }

  // ─── Email 2: Perk Redeemed ───────────────────────────────────
  if (user.email && redemption && perk) {
    try {
      const { data: venue } = await supabase.from("venues").select("name").eq("id", redemption.venue_id).single();
      const vName = venue?.name || "Venue";
      const expiresStr = redemption.expires_at
        ? new Date(redemption.expires_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
        : "7 days";
      const remaining = balance?.balance ?? 0;

      const redeemUrl = `https://thekickback.net/wallet/redeem/${redemptionId}`;
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(redeemUrl)}&bgcolor=000000&color=FFFFFF&format=png`;

      sendEmail(user.email, `${perk.name} — show this QR to redeem`, wrap(`
        <div style="text-align:center;margin-bottom:20px;">
          <h1 style="margin:0;font-size:22px;color:#fff;">${perk.name}</h1>
          <p style="margin:4px 0 0;font-size:14px;color:rgba(255,255,255,0.5);">${vName}</p>
        </div>
        <div style="text-align:center;margin-bottom:20px;">
          <div style="display:inline-block;padding:16px;background:#111;border-radius:16px;border:1px solid rgba(255,255,255,0.1);">
            <img src="${qrUrl}" alt="Redemption QR" width="200" height="200" style="display:block;border-radius:8px;" />
          </div>
          <p style="margin:12px 0 0;font-size:13px;color:rgba(255,255,255,0.35);">Show this QR code to staff to claim your perk</p>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr><td style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.5);">Perk</td><td style="text-align:right;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:#fff;font-weight:600;">${perk.name}</td></tr>
          <tr><td style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.5);">Points spent</td><td style="text-align:right;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:#F97316;font-weight:600;">-${redemption.points_spent}</td></tr>
          <tr><td style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.5);">Remaining</td><td style="text-align:right;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:#fff;">${remaining} pts</td></tr>
          <tr><td style="padding:8px 0;color:rgba(255,255,255,0.5);">Expires</td><td style="text-align:right;padding:8px 0;color:#fff;">${expiresStr}</td></tr>
        </table>
        <div style="text-align:center;margin-top:20px;">
          <a href="https://thekickback.net/wallet/reward/${redemptionId}" style="display:inline-block;padding:12px 28px;background:#4ADE80;color:#000;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;">Add to Apple Wallet</a>
        </div>
        <p style="text-align:center;margin-top:12px;font-size:11px;color:rgba(255,255,255,0.2);">Redemption ID: ${String(redemptionId).substring(0, 8)}</p>
      `));
    } catch (e) { console.error("Perk redeemed email failed:", e); }
  }

  // Push notification for perk redemption
  if (perk) {
    sendPushToUser(user.id, {
      title: `${perk.name} redeemed`,
      body: `Show the QR code to claim your perk. Check your email.`,
      url: "/",
      tag: "perk",
    }).catch(() => {});
  }

  return NextResponse.json({
    ok: true,
    redemptionId,
    pointsSpent: perk?.point_cost,
    remainingBalance: balance?.balance,
  });
}
