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

export async function verifyOtp(email: string, token: string, deviceId: string, deviceName: string, returnTo?: string) {
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

  redirect(returnTo || "/");
}
