"use server";

import { createClient } from "@supabase/supabase-js";
import { createClient as createAuthClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const ROOT_USER_IDS: string[] = [
    // Add your Supabase auth user ID here
    // You can find it in Supabase Dashboard → Authentication → Users
];

const service = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
);

async function assertRoot(): Promise<string> {
    const supabase = await createAuthClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");
    // If ROOT_USER_IDS is empty, allow any authenticated venue owner (bootstrap mode)
    if (ROOT_USER_IDS.length > 0 && !ROOT_USER_IDS.includes(user.id)) {
        throw new Error("Not authorized");
    }
    return user.id;
}

export async function approveVenue(venuePageId: string) {
    await assertRoot();
    const { error } = await service
        .from("venue_pages")
        .update({ review_status: "approved", published: true })
        .eq("id", venuePageId);

    if (error) return { error: error.message };
    revalidatePath("/root");
    return { ok: true };
}

export async function rejectVenue(venuePageId: string) {
    await assertRoot();
    const { error } = await service
        .from("venue_pages")
        .update({ review_status: "rejected", published: false })
        .eq("id", venuePageId);

    if (error) return { error: error.message };
    revalidatePath("/root");
    return { ok: true };
}

export async function unpublishVenue(venuePageId: string) {
    await assertRoot();
    const { error } = await service
        .from("venue_pages")
        .update({ published: false })
        .eq("id", venuePageId);

    if (error) return { error: error.message };
    revalidatePath("/root");
    return { ok: true };
}
