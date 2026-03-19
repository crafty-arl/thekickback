"use server";

import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

const service = createServiceClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

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

export async function verifyOtp(email: string, token: string, deviceId: string, returnTo?: string) {
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

  // ─── Device-per-email enforcement ──────────────────────────
  // Check if this email already has a registered device
  const { data: profile } = await service
    .from("profiles")
    .select("device_id")
    .eq("id", data.user.id)
    .maybeSingle();

  if (profile?.device_id && profile.device_id !== deviceId) {
    // Different device trying to use this account — reject
    await supabase.auth.signOut();
    return {
      error: "This account is already registered to another device. Each email can only be used on one device.",
    };
  }

  // Upsert profile with device_id
  await service.from("profiles").upsert(
    {
      id: data.user.id,
      email: data.user.email,
      device_id: deviceId,
    },
    { onConflict: "id" }
  );

  // Also check: is this device already registered to a DIFFERENT email?
  const { data: otherProfile } = await service
    .from("profiles")
    .select("id, email")
    .eq("device_id", deviceId)
    .neq("id", data.user.id)
    .maybeSingle();

  if (otherProfile) {
    // This device is already bound to another account — reject
    await supabase.auth.signOut();
    // Clear the device_id we just set
    await service.from("profiles").update({ device_id: null }).eq("id", data.user.id);
    return {
      error: `This device is already registered to ${otherProfile.email}. One device per account.`,
    };
  }

  redirect(returnTo || "/");
}
