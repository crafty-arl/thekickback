"use server";

import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { sendEmail, wrap } from "@/lib/email";

function getServiceClient() {
  return createServiceClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
}

const MAX_DEVICES = 3;

export async function sendOtp(email: string) {
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
    },
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

// ─── Referral key helpers ──────────────────────────────────────
function generateReferralKey(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const seg = (n: number) => Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `kb-${seg(4)}-${seg(4)}`;
}

async function generateKeysForUser(service: ReturnType<typeof getServiceClient>, userId: string) {
  const keys = Array.from({ length: 5 }, () => ({ user_id: userId, key: generateReferralKey() }));
  await service.from("referral_keys").insert(keys);
  return keys.map((k) => k.key);
}

export async function verifyOtp(email: string, token: string, deviceId: string, deviceName: string, returnTo?: string, referralKey?: string) {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "email",
  });

  if (error) {
    return { error: error.message };
  }

  if (!data.user) {
    return { error: "Verification failed." };
  }

  // ─── Multi-device enforcement (max 3) ──────────────────────
  const service = getServiceClient();

  // Check if this device is already registered to this user
  const { data: existingDevice, error: deviceQueryError } = await service
    .from("user_devices")
    .select("id")
    .eq("user_id", data.user.id)
    .eq("device_id", deviceId)
    .maybeSingle();

  if (deviceQueryError) {
    console.error("Device query error:", deviceQueryError.message, deviceQueryError.code);
    // Table might not exist — skip device enforcement but continue login
  }

  if (!deviceQueryError) {
    if (existingDevice) {
      // Known device — update last_active and device name
      await service.from("user_devices").update({
        last_active_at: new Date().toISOString(),
        device_name: deviceName || null,
      }).eq("id", existingDevice.id);
    } else {
      // New device — check how many devices this user already has
      const { count } = await service
        .from("user_devices")
        .select("id", { count: "exact", head: true })
        .eq("user_id", data.user.id);

      if ((count || 0) >= MAX_DEVICES) {
        await supabase.auth.signOut();
        return {
          error: `You already have ${MAX_DEVICES} devices registered. Remove a device from Settings → Devices to add this one.`,
        };
      }

      // Register this device
      const { error: insertError } = await service.from("user_devices").insert({
        user_id: data.user.id,
        device_id: deviceId,
        device_name: deviceName || null,
      });
      if (insertError) {
        console.error("Device insert error:", insertError.message, insertError.code);
      }

      // ─── New Device Login Email ──────────────────────────────
      try {
        if (email) {
          const displayDevice = deviceName || "a new device";
          const now = new Date();
          const dateStr = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
          const timeStr = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

          sendEmail(email, "New sign-in to theKickBack", wrap(`
            <div style="background:rgba(255,255,255,0.04);border-radius:16px;padding:32px;text-align:center;margin-bottom:24px;">
              <div style="font-size:36px;margin-bottom:8px;">&#128274;</div>
              <h1 style="margin:0;font-size:24px;color:#fff;">New sign-in</h1>
            </div>
            <table style="width:100%;border-collapse:collapse;font-size:14px;">
              <tr><td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.5);">Device</td><td style="text-align:right;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:#fff;">${displayDevice}</td></tr>
              <tr><td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.5);">Date</td><td style="text-align:right;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:#fff;">${dateStr}</td></tr>
              <tr><td style="padding:10px 0;color:rgba(255,255,255,0.5);">Time</td><td style="text-align:right;padding:10px 0;color:#fff;">${timeStr}</td></tr>
            </table>
            <p style="margin:16px 0 0;font-size:13px;color:rgba(255,255,255,0.4);text-align:center;">If this wasn't you, secure your account by removing unknown devices in Settings.</p>
          `));
        }
      } catch (e) { console.error("New device email failed:", e); }
    }
  }

  // Upsert profile (keep legacy device_id for backwards compat)
  await service.from("profiles").upsert(
    {
      id: data.user.id,
      email: data.user.email,
      device_id: deviceId,
    },
    { onConflict: "id" }
  );

  // ─── Waitlist / Referral Gate ─────────────────────────────────
  try {
    // Check if user is already approved
    const { data: existing } = await service
      .from("waitlist")
      .select("id, status")
      .eq("email", email.toLowerCase().trim())
      .maybeSingle();

    if (existing?.status === "approved") {
      // Already approved — proceed
      redirect(returnTo || "/");
    }

    if (existing?.status === "rejected") {
      await supabase.auth.signOut();
      return { error: "Your access request was not approved." };
    }

    if (existing?.status === "pending") {
      // Already on waitlist — show waitlist screen
      await supabase.auth.signOut();
      return { error: null, waitlisted: true };
    }

    // Not in waitlist yet — check referral key
    if (referralKey) {
      const { data: refKey } = await service
        .from("referral_keys")
        .select("id, user_id, used_by_email")
        .eq("key", referralKey.toLowerCase().trim())
        .maybeSingle();

      if (refKey && !refKey.used_by_email) {
        // Valid unused referral key — auto-approve
        await service.from("referral_keys").update({
          used_by_email: email.toLowerCase().trim(),
          used_at: new Date().toISOString(),
        }).eq("id", refKey.id);

        await service.from("waitlist").insert({
          email: email.toLowerCase().trim(),
          status: "approved",
          referred_by: refKey.user_id,
          referral_key: referralKey.toLowerCase().trim(),
          approved_at: new Date().toISOString(),
        });

        // Generate 5 referral keys for the new user
        const newKeys = await generateKeysForUser(service, data.user.id);

        // Send approved email with referral keys
        try {
          const keyLinks = newKeys.map((k) => `<li style="margin:4px 0;"><a href="https://join.thekickback.net?ref=${k}" style="color:#F97316;text-decoration:none;font-family:monospace;">${k}</a></li>`).join("");
          sendEmail(email, "You're in — welcome to theKickBack", wrap(`
            <div style="background:linear-gradient(135deg,rgba(249,115,22,0.15),rgba(249,115,22,0.05));border-radius:16px;padding:32px;text-align:center;margin-bottom:24px;">
              <div style="font-size:48px;margin-bottom:8px;">&#127881;</div>
              <h1 style="margin:0;font-size:28px;color:#F97316;">You're in.</h1>
            </div>
            <p style="color:rgba(255,255,255,0.7);font-size:15px;line-height:1.5;">
              Someone invited you to <strong style="color:#fff;">theKickBack</strong> and you're officially on the list.
            </p>
            <div style="background:#111;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:16px;margin:16px 0;">
              <strong style="color:#F97316;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Your referral keys</strong>
              <p style="margin:8px 0 4px;color:rgba(255,255,255,0.5);font-size:13px;">Share these with friends to skip the waitlist:</p>
              <ul style="list-style:none;padding:0;margin:0;">${keyLinks}</ul>
            </div>
            <div style="text-align:center;margin-top:24px;">
              <a href="https://join.thekickback.net" style="display:inline-block;background:#F97316;color:#000;padding:14px 32px;border-radius:12px;text-decoration:none;font-weight:600;font-size:15px;">Open theKickBack</a>
            </div>
          `));
        } catch (e) { console.error("Referral approved email failed:", e); }

        // Notify the referrer
        try {
          const { data: referrerProfile } = await service.from("profiles").select("email").eq("id", refKey.user_id).single();
          if (referrerProfile?.email) {
            const { count: unusedCount } = await service
              .from("referral_keys")
              .select("id", { count: "exact", head: true })
              .eq("user_id", refKey.user_id)
              .is("used_by_email", null);
            const remaining = (unusedCount || 0);
            sendEmail(referrerProfile.email, "Someone joined using your invite", wrap(`
              <div style="background:rgba(255,255,255,0.04);border-radius:16px;padding:32px;text-align:center;margin-bottom:24px;">
                <div style="font-size:36px;margin-bottom:8px;">&#128588;</div>
                <h1 style="margin:0;font-size:24px;color:#fff;">Your invite worked</h1>
              </div>
              <p style="color:rgba(255,255,255,0.7);font-size:15px;line-height:1.5;">
                <strong style="color:#fff;">${email}</strong> joined theKickBack using your referral key.
              </p>
              <p style="color:rgba(255,255,255,0.4);font-size:13px;">You've got ${remaining} key${remaining === 1 ? "" : "s"} remaining. Keep sharing.</p>
            `));
          }
        } catch (e) { console.error("Referral notify email failed:", e); }

        redirect(returnTo || "/");
      }
    }

    // No valid referral key — add to waitlist as pending
    await service.from("waitlist").insert({
      email: email.toLowerCase().trim(),
      status: "pending",
      referral_key: referralKey || null,
    });

    // Notify admin of new waitlist signup
    try {
      sendEmail("carl@craftthefuture.xyz", "New waitlist signup", wrap(`
        <div style="background:rgba(249,115,22,0.08);border-radius:16px;padding:24px;text-align:center;margin-bottom:24px;">
          <div style="font-size:36px;margin-bottom:8px;">&#128220;</div>
          <h1 style="margin:0;font-size:24px;color:#F97316;">New waitlist signup</h1>
        </div>
        <p style="color:rgba(255,255,255,0.7);font-size:15px;"><strong style="color:#fff;">${email}</strong> just signed up for the waitlist.</p>
        <div style="text-align:center;margin-top:20px;">
          <a href="https://dash.thekickback.net/root" style="display:inline-block;background:#F97316;color:#000;padding:12px 24px;border-radius:12px;text-decoration:none;font-weight:600;font-size:14px;">Review in Root</a>
        </div>
      `));
    } catch (e) { console.error("Admin waitlist email failed:", e); }

    // Send waitlisted email to user
    try {
      sendEmail(email, "You're on the list — theKickBack", wrap(`
        <div style="background:linear-gradient(135deg,rgba(249,115,22,0.15),rgba(249,115,22,0.05));border-radius:16px;padding:32px;text-align:center;margin-bottom:24px;">
          <div style="font-size:48px;margin-bottom:8px;">&#9203;</div>
          <h1 style="margin:0;font-size:28px;color:#F97316;">You're on the list.</h1>
        </div>
        <p style="color:rgba(255,255,255,0.7);font-size:15px;line-height:1.5;">
          We got your request to join <strong style="color:#fff;">theKickBack</strong>. We're letting people in gradually and you'll get an email as soon as you're approved.
        </p>
        <p style="color:rgba(255,255,255,0.4);font-size:13px;margin-top:16px;">
          Want to skip the line? Ask a friend who's already on theKickBack for a referral key.
        </p>
      `));
    } catch (e) { console.error("Waitlisted email failed:", e); }

    await supabase.auth.signOut();
    return { error: null, waitlisted: true };
  } catch (e: unknown) {
    // redirect() throws a NEXT_REDIRECT "error" — let it propagate
    if (e && typeof e === "object" && "digest" in e && typeof (e as { digest: string }).digest === "string" && (e as { digest: string }).digest.startsWith("NEXT_REDIRECT")) {
      throw e;
    }
    console.error("Waitlist check error:", e);
    // If waitlist check fails, let user through (fail-open)
    redirect(returnTo || "/");
  }
}
