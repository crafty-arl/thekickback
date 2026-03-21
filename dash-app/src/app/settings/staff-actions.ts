"use server";

import { createClient } from "@supabase/supabase-js";
import { createClient as createAuthClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { sendEmail, wrap } from "@/lib/email";

const service = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
);

async function verifyOwnership(venueId: string) {
    const supabase = await createAuthClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: owner } = await service
        .from("venue_owners")
        .select("id, role")
        .eq("user_id", user.id)
        .eq("venue_id", venueId)
        .single();

    // Only owners and managers can manage staff
    if (!owner || owner.role === "staff") return null;
    return user;
}

export async function getStaffMembers(venueId: string) {
    const { data, error } = await service
        .from("venue_staff")
        .select("id, display_name, role_title, avatar_url, bio, specialties, visible, sort_order, schedule, email, invite_status, user_id, created_at")
        .eq("venue_id", venueId)
        .order("sort_order", { ascending: true });

    if (error) return { error: error.message, staff: [] };
    return { staff: data || [] };
}

export async function addStaffMember(
    venueId: string,
    data: {
        email: string;
        display_name?: string;
        role_title?: string;
        bio?: string;
        specialties?: string[];
    }
) {
    const user = await verifyOwnership(venueId);
    if (!user) return { error: "Not authorized" };

    if (!data.email || !data.email.includes("@")) return { error: "Valid email required" };

    const email = data.email.trim().toLowerCase();

    // Check if this email is already staff at this venue
    const { data: existing } = await service
        .from("venue_staff")
        .select("id")
        .eq("venue_id", venueId)
        .eq("email", email)
        .limit(1);

    if (existing && existing.length > 0) return { error: "This email is already on your team" };

    // Check if a KickBack profile exists with this email
    const { data: profile } = await service
        .from("profiles")
        .select("id, display_name, email")
        .eq("email", email)
        .single();

    // Get next sort order
    const { data: existingStaff } = await service
        .from("venue_staff")
        .select("sort_order")
        .eq("venue_id", venueId)
        .order("sort_order", { ascending: false })
        .limit(1);

    const nextOrder = existingStaff && existingStaff.length > 0 ? (existingStaff[0].sort_order || 0) + 1 : 0;

    // If profile exists → auto-link, accepted
    // If not → pending invite
    const staffData: Record<string, unknown> = {
        venue_id: venueId,
        email: email,
        display_name: data.display_name?.trim() || (profile?.display_name) || email.split("@")[0],
        role_title: data.role_title || null,
        bio: data.bio || null,
        specialties: data.specialties || [],
        sort_order: nextOrder,
        user_id: profile?.id || null,
        invite_status: profile ? "accepted" : "pending",
    };

    const { data: newStaff, error } = await service
        .from("venue_staff")
        .insert(staffData)
        .select("id, display_name, role_title, avatar_url, bio, specialties, visible, sort_order, schedule, email, invite_status, user_id, created_at")
        .single();

    if (error) return { error: error.message };

    // If profile exists, also add them to venue_owners with role=staff
    if (profile) {
        await service.from("venue_owners").upsert({
            user_id: profile.id,
            venue_id: venueId,
            role: "staff",
        }, { onConflict: "user_id,venue_id" });
    }

    // ─── Staff Invite Email ──────────────────────────────────────
    try {
        const { data: venue } = await service
            .from("venues")
            .select("name")
            .eq("id", venueId)
            .single();
        const venueName = venue?.name || "a venue";
        const roleName = data.role_title || "Team Member";

        sendEmail(email, `You've been added to ${venueName}`, wrap(`
            <div style="background:linear-gradient(135deg,rgba(249,115,22,0.2),rgba(249,115,22,0.05));border-radius:16px;padding:32px;text-align:center;margin-bottom:24px;">
              <div style="font-size:36px;margin-bottom:8px;">&#128188;</div>
              <h1 style="margin:0;font-size:24px;color:#fff;">You're on the team.</h1>
            </div>
            <table style="width:100%;border-collapse:collapse;font-size:14px;">
              <tr><td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.5);">Venue</td><td style="text-align:right;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:#fff;font-weight:600;">${venueName}</td></tr>
              <tr><td style="padding:10px 0;color:rgba(255,255,255,0.5);">Role</td><td style="text-align:right;padding:10px 0;color:#F97316;font-weight:600;">${roleName}</td></tr>
            </table>
            <p style="margin:16px 0 0;font-size:13px;color:rgba(255,255,255,0.4);text-align:center;">Your venue owner added you as staff.</p>
            <div style="text-align:center;margin-top:20px;">
              <a href="https://dash.thekickback.net" style="display:inline-block;padding:12px 28px;background:#F97316;color:#fff;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;">Open Dashboard</a>
            </div>
        `));
    } catch (e) { console.error("Staff invite email failed:", e); }

    revalidatePath("/settings");
    return { ok: true, staff: newStaff };
}

export async function updateStaffMember(
    venueId: string,
    staffId: string,
    data: {
        display_name?: string;
        role_title?: string;
        bio?: string;
        specialties?: string[];
        visible?: boolean;
        schedule?: { day: string; start: string; end: string }[];
    }
) {
    const user = await verifyOwnership(venueId);
    if (!user) return { error: "Not authorized" };

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.display_name !== undefined) updateData.display_name = data.display_name;
    if (data.role_title !== undefined) updateData.role_title = data.role_title;
    if (data.bio !== undefined) updateData.bio = data.bio;
    if (data.specialties !== undefined) updateData.specialties = data.specialties;
    if (data.visible !== undefined) updateData.visible = data.visible;
    if (data.schedule !== undefined) updateData.schedule = data.schedule;

    const { error } = await service
        .from("venue_staff")
        .update(updateData)
        .eq("id", staffId)
        .eq("venue_id", venueId);

    if (error) return { error: error.message };

    revalidatePath("/settings");
    return { ok: true };
}

export async function deleteStaffMember(venueId: string, staffId: string) {
    const user = await verifyOwnership(venueId);
    if (!user) return { error: "Not authorized" };

    // Get the staff record to clean up venue_owners
    const { data: staff } = await service
        .from("venue_staff")
        .select("user_id")
        .eq("id", staffId)
        .eq("venue_id", venueId)
        .single();

    const { error } = await service
        .from("venue_staff")
        .delete()
        .eq("id", staffId)
        .eq("venue_id", venueId);

    if (error) return { error: error.message };

    // Also remove from venue_owners if they were linked
    if (staff?.user_id) {
        await service
            .from("venue_owners")
            .delete()
            .eq("user_id", staff.user_id)
            .eq("venue_id", venueId)
            .eq("role", "staff");
    }

    revalidatePath("/settings");
    return { ok: true };
}

export async function uploadStaffAvatar(venueId: string, staffId: string, formData: FormData) {
    const user = await verifyOwnership(venueId);
    if (!user) return { error: "Not authorized" };

    const file = formData.get("file") as File;
    if (!file) return { error: "No file uploaded" };

    const ext = file.name.split(".").pop() || "jpg";
    const fileName = `${venueId}/staff/${staffId}.${ext}`;

    const { data: uploadData, error: uploadError } = await service
        .storage
        .from("venue-assets")
        .upload(fileName, file, { upsert: true, contentType: file.type });

    if (uploadError) return { error: uploadError.message };

    const { data: { publicUrl } } = service
        .storage
        .from("venue-assets")
        .getPublicUrl(uploadData.path);

    const { error } = await service
        .from("venue_staff")
        .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
        .eq("id", staffId)
        .eq("venue_id", venueId);

    if (error) return { error: error.message };

    revalidatePath("/settings");
    return { ok: true, url: publicUrl };
}

export async function toggleStaffVisibility(venueId: string, staffId: string, visible: boolean) {
    const user = await verifyOwnership(venueId);
    if (!user) return { error: "Not authorized" };

    const { error } = await service
        .from("venue_staff")
        .update({ visible, updated_at: new Date().toISOString() })
        .eq("id", staffId)
        .eq("venue_id", venueId);

    if (error) return { error: error.message };

    revalidatePath("/settings");
    return { ok: true };
}
