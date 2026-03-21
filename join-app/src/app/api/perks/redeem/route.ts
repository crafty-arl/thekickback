import { NextRequest, NextResponse } from "next/server";
import { createClient as createAuthClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail, wrap } from "@/lib/email";

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

  // ─── Email 2: Perk Redeemed ───────────────────────────────────
  if (user.email && redemption && perk) {
    try {
      const { data: venue } = await supabase.from("venues").select("name").eq("id", redemption.venue_id).single();
      const vName = venue?.name || "Venue";
      const expiresStr = redemption.expires_at
        ? new Date(redemption.expires_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
        : "7 days";
      const remaining = balance?.balance ?? 0;

      sendEmail(user.email, `Perk redeemed — ${perk.name}`, wrap(`
        <div style="text-align:center;margin-bottom:24px;">
          <div style="width:56px;height:56px;border-radius:50%;background:#4ADE80;margin:0 auto 12px;display:flex;align-items:center;justify-content:center;">
            <span style="font-size:28px;color:#000;line-height:56px;">&#10003;</span>
          </div>
          <h1 style="margin:0;font-size:24px;color:#fff;">Perk redeemed.</h1>
          <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.5);">${vName}</p>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr><td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.5);">Perk</td><td style="text-align:right;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:#fff;font-weight:600;">${perk.name}</td></tr>
          <tr><td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.5);">Points spent</td><td style="text-align:right;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:#F97316;font-weight:600;">-${redemption.points_spent}</td></tr>
          <tr><td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.5);">Remaining</td><td style="text-align:right;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:#fff;">${remaining} pts</td></tr>
          <tr><td style="padding:10px 0;color:rgba(255,255,255,0.5);">Expires</td><td style="text-align:right;padding:10px 0;color:#fff;">${expiresStr}</td></tr>
        </table>
        <div style="text-align:center;margin-top:24px;">
          <a href="https://thekickback.net/wallet/reward/${redemptionId}" style="display:inline-block;padding:12px 28px;background:#4ADE80;color:#000;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;">Add Reward to Wallet</a>
        </div>
      `));
    } catch (e) { console.error("Perk redeemed email failed:", e); }
  }

  return NextResponse.json({
    ok: true,
    redemptionId,
    pointsSpent: perk?.point_cost,
    remainingBalance: balance?.balance,
  });
}
