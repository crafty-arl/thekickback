"use server";

import { createClient } from "@supabase/supabase-js";
import { createClient as createAuthClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

// ─── Admin whitelist ─────────────────────────────────────────────
const ROOT_EMAILS: string[] = [
    "carl@craftthefuture.xyz",
];

const service = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
);

async function assertRoot(): Promise<string> {
    const cookieStore = await cookies();
    const rootToken = cookieStore.get("root_access")?.value;
    if (!rootToken) throw new Error("Root access required");

    const supabase = await createAuthClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");
    if (!user.email || !ROOT_EMAILS.includes(user.email)) {
        throw new Error("Not authorized");
    }
    return user.id;
}

// ─── OTP actions ─────────────────────────────────────────────────

export async function rootSendOtp(email: string) {
    if (!ROOT_EMAILS.includes(email.toLowerCase().trim())) {
        return { error: "Access denied" };
    }

    const supabase = await createAuthClient();
    const { error } = await supabase.auth.signInWithOtp({
        email: email.toLowerCase().trim(),
        options: { shouldCreateUser: true },
    });

    if (error) return { error: error.message };
    return { success: true };
}

export async function rootVerifyOtp(email: string, token: string) {
    if (!ROOT_EMAILS.includes(email.toLowerCase().trim())) {
        return { error: "Access denied" };
    }

    const supabase = await createAuthClient();
    const { data, error } = await supabase.auth.verifyOtp({
        email: email.toLowerCase().trim(),
        token,
        type: "email",
    });

    if (error) return { error: error.message };

    if (data.user) {
        await supabase.from("profiles").upsert(
            { id: data.user.id, email: data.user.email },
            { onConflict: "id" },
        );
    }

    // Set root access cookie — expires in 1 hour
    const cookieStore = await cookies();
    cookieStore.set("root_access", "granted", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60, // 1 hour
        path: "/root",
    });

    revalidatePath("/root");
    return { success: true };
}

// ─── Venue approval actions ──────────────────────────────────────

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
