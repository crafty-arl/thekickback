"use server";

import { createClient } from "@supabase/supabase-js";
import { createClient as createAuthClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

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
        .select("id, display_name, role_title, avatar_url, bio, specialties, visible, sort_order, schedule, created_at")
        .eq("venue_id", venueId)
        .order("sort_order", { ascending: true });

    if (error) return { error: error.message, staff: [] };
    return { staff: data || [] };
}

export async function addStaffMember(
    venueId: string,
    data: {
        display_name: string;
        role_title?: string;
        bio?: string;
        specialties?: string[];
    }
) {
    const user = await verifyOwnership(venueId);
    if (!user) return { error: "Not authorized" };

    // Get next sort order
    const { data: existing } = await service
        .from("venue_staff")
        .select("sort_order")
        .eq("venue_id", venueId)
        .order("sort_order", { ascending: false })
        .limit(1);

    const nextOrder = existing && existing.length > 0 ? (existing[0].sort_order || 0) + 1 : 0;

    const { data: newStaff, error } = await service
        .from("venue_staff")
        .insert({
            venue_id: venueId,
            display_name: data.display_name,
            role_title: data.role_title || null,
            bio: data.bio || null,
            specialties: data.specialties || [],
            sort_order: nextOrder,
        })
        .select("id, display_name, role_title, avatar_url, bio, specialties, visible, sort_order, schedule, created_at")
        .single();

    if (error) return { error: error.message };

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

    const { error } = await service
        .from("venue_staff")
        .delete()
        .eq("id", staffId)
        .eq("venue_id", venueId);

    if (error) return { error: error.message };

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
