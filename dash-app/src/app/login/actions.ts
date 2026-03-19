"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

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

export async function verifyOtp(email: string, token: string) {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "email",
  });

  if (error) {
    return { error: error.message };
  }

  // Ensure a profile row exists for this user
  if (data.user) {
    await supabase.from("profiles").upsert(
      {
        id: data.user.id,
        email: data.user.email,
      },
      { onConflict: "id" }
    );

    // Auto-link any pending staff invites for this email
    if (data.user.email) {
      const { createClient: createServiceClient } = await import("@supabase/supabase-js");
      const service = createServiceClient(
        process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_KEY!,
      );

      // Find pending staff records with this email
      const { data: pendingStaff } = await service
        .from("venue_staff")
        .select("id, venue_id, display_name")
        .eq("email", data.user.email.toLowerCase())
        .eq("invite_status", "pending");

      if (pendingStaff && pendingStaff.length > 0) {
        for (const staff of pendingStaff) {
          // Link user_id and mark as accepted
          await service.from("venue_staff").update({
            user_id: data.user.id,
            invite_status: "accepted",
            updated_at: new Date().toISOString(),
          }).eq("id", staff.id);

          // Create venue_owners row so dash-app recognizes them
          await service.from("venue_owners").upsert({
            user_id: data.user.id,
            venue_id: staff.venue_id,
            role: "staff",
          }, { onConflict: "user_id,venue_id" });
        }
      }
    }
  }

  redirect("/");
}
