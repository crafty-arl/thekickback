"use server";

import { createClient } from "@supabase/supabase-js";
import { createClient as createAuthClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const service = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
);

// Get the logged-in user's staff profile
export async function getMyStaffProfile() {
    const supabase = await createAuthClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Not logged in" };

    const { data, error } = await service
        .from("venue_staff")
        .select("id, venue_id, display_name, role_title, avatar_url, bio, specialties, visible, schedule, email, invite_status, venues(id, name)")
        .eq("user_id", user.id)
        .limit(1)
        .single();

    if (error) return { error: "No staff profile found" };
    return { profile: data };
}

// Staff updates their own schedule
export async function updateOwnSchedule(staffId: string, schedule: { day: string; start: string; end: string }[]) {
    const supabase = await createAuthClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Not logged in" };

    // Verify this staff record belongs to the logged-in user
    const { data: staff } = await service
        .from("venue_staff")
        .select("id, user_id")
        .eq("id", staffId)
        .single();

    if (!staff || staff.user_id !== user.id) return { error: "Not authorized" };

    const { error } = await service
        .from("venue_staff")
        .update({ schedule: JSON.stringify(schedule), updated_at: new Date().toISOString() })
        .eq("id", staffId);

    if (error) return { error: error.message };

    revalidatePath("/staff");
    return { ok: true };
}

// Staff updates their own bio and specialties
export async function updateOwnProfile(staffId: string, data: { bio?: string; specialties?: string[]; display_name?: string }) {
    const supabase = await createAuthClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Not logged in" };

    // Verify
    const { data: staff } = await service
        .from("venue_staff")
        .select("id, user_id")
        .eq("id", staffId)
        .single();

    if (!staff || staff.user_id !== user.id) return { error: "Not authorized" };

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.bio !== undefined) updateData.bio = data.bio;
    if (data.specialties !== undefined) updateData.specialties = data.specialties;
    if (data.display_name !== undefined) updateData.display_name = data.display_name;

    const { error } = await service
        .from("venue_staff")
        .update(updateData)
        .eq("id", staffId);

    if (error) return { error: error.message };

    revalidatePath("/staff");
    return { ok: true };
}
