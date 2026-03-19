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

    if (!owner || owner.role === "staff") return null;
    return user;
}

export async function linkStaffToOffering(venueId: string, staffId: string, offeringId: string) {
    const user = await verifyOwnership(venueId);
    if (!user) return { error: "Not authorized" };

    const { error } = await service
        .from("staff_offerings")
        .insert({ staff_id: staffId, offering_id: offeringId });

    if (error) {
        if (error.code === "23505") return { ok: true }; // already linked
        return { error: error.message };
    }

    revalidatePath("/settings");
    return { ok: true };
}

export async function unlinkStaffFromOffering(venueId: string, staffId: string, offeringId: string) {
    const user = await verifyOwnership(venueId);
    if (!user) return { error: "Not authorized" };

    const { error } = await service
        .from("staff_offerings")
        .delete()
        .eq("staff_id", staffId)
        .eq("offering_id", offeringId);

    if (error) return { error: error.message };

    revalidatePath("/settings");
    return { ok: true };
}

export async function getStaffOfferingLinks(venueId: string) {
    // Get all staff-offering links for all staff in this venue
    const { data: staffMembers } = await service
        .from("venue_staff")
        .select("id")
        .eq("venue_id", venueId);

    if (!staffMembers || staffMembers.length === 0) return { links: [] };

    const staffIds = staffMembers.map((s) => s.id);

    const { data, error } = await service
        .from("staff_offerings")
        .select("staff_id, offering_id")
        .in("staff_id", staffIds);

    if (error) return { error: error.message, links: [] };
    return { links: data || [] };
}
