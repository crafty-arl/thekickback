"use server";

import { createClient } from "@supabase/supabase-js";
import { createClient as createAuthClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { sendEmail, wrap } from "@/lib/email";

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

    // Send approval email to venue owner
    try {
        const { data: page } = await service
            .from("venue_pages")
            .select("venue_id, slug")
            .eq("id", venuePageId)
            .single();
        if (page) {
            const { data: venue } = await service.from("venues").select("name").eq("id", page.venue_id).single();
            const { data: owner } = await service.from("venue_owners").select("user_id").eq("venue_id", page.venue_id).limit(1).single();
            if (owner) {
                const { data: profile } = await service.from("profiles").select("email").eq("id", owner.user_id).single();
                const email = profile?.email;
                const venueName = venue?.name || "Your hub";
                const slug = page.slug;
                if (email) {
                    sendEmail(email, `${venueName} is live on theKickBack`, wrap(`
                        <div style="background:linear-gradient(135deg,rgba(74,222,128,0.15),rgba(74,222,128,0.05));border-radius:16px;padding:32px;text-align:center;margin-bottom:24px;">
                            <div style="font-size:48px;margin-bottom:8px;">&#10003;</div>
                            <h1 style="margin:0;font-size:28px;color:#4ADE80;">You're live.</h1>
                        </div>
                        <p style="color:rgba(255,255,255,0.7);font-size:15px;line-height:1.5;">
                            <strong style="color:#fff;">${venueName}</strong> has been approved and is now visible to everyone on theKickBack.
                        </p>
                        <p style="color:rgba(255,255,255,0.5);font-size:13px;">Your public link:</p>
                        <p style="margin:8px 0 24px;">
                            <a href="https://join.thekickback.net/${slug}" style="color:#F97316;text-decoration:none;font-weight:600;">join.thekickback.net/${slug}</a>
                        </p>
                        <div style="background:#111;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:16px;margin-bottom:12px;">
                            <strong style="color:#F97316;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Share</strong>
                            <p style="margin:4px 0 0;color:rgba(255,255,255,0.6);font-size:13px;">Send your link to regulars. Post it on socials. Put it in your bio.</p>
                        </div>
                        <div style="background:#111;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:16px;margin-bottom:24px;">
                            <strong style="color:#F97316;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">QR Code</strong>
                            <p style="margin:4px 0 0;color:rgba(255,255,255,0.6);font-size:13px;">Print it. Stick it on the counter. Guests scan and they're in.</p>
                        </div>
                        <div style="text-align:center;">
                            <a href="https://dash.thekickback.net" style="display:inline-block;background:#F97316;color:#fff;padding:14px 32px;border-radius:12px;text-decoration:none;font-weight:600;font-size:15px;">Open Dashboard</a>
                        </div>
                    `));
                }
            }
        }
    } catch (e) { console.error("Approve email failed:", e); }

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

    // Send rejection email to venue owner
    try {
        const { data: page } = await service
            .from("venue_pages")
            .select("venue_id, slug")
            .eq("id", venuePageId)
            .single();
        if (page) {
            const { data: venue } = await service.from("venues").select("name").eq("id", page.venue_id).single();
            const { data: owner } = await service.from("venue_owners").select("user_id").eq("venue_id", page.venue_id).limit(1).single();
            if (owner) {
                const { data: profile } = await service.from("profiles").select("email").eq("id", owner.user_id).single();
                const email = profile?.email;
                const venueName = venue?.name || "Your hub";
                if (email) {
                    sendEmail(email, `${venueName} needs a few changes`, wrap(`
                        <div style="background:linear-gradient(135deg,rgba(239,68,68,0.15),rgba(239,68,68,0.05));border-radius:16px;padding:32px;text-align:center;margin-bottom:24px;">
                            <div style="font-size:48px;margin-bottom:8px;color:#EF4444;">!</div>
                            <h1 style="margin:0;font-size:28px;color:#EF4444;">Not quite yet.</h1>
                        </div>
                        <p style="color:rgba(255,255,255,0.7);font-size:15px;line-height:1.5;">
                            <strong style="color:#fff;">${venueName}</strong> wasn't approved this time. Here are a few things to check:
                        </p>
                        <ul style="color:rgba(255,255,255,0.5);font-size:13px;line-height:1.8;padding-left:20px;">
                            <li>Add a clear tagline and description</li>
                            <li>Upload at least one photo</li>
                            <li>Set your hours and address</li>
                            <li>Add at least one menu item or offering</li>
                        </ul>
                        <div style="text-align:center;margin-top:24px;">
                            <a href="https://dash.thekickback.net/edit" style="display:inline-block;background:#EF4444;color:#fff;padding:14px 32px;border-radius:12px;text-decoration:none;font-weight:600;font-size:15px;">Edit &amp; Resubmit</a>
                        </div>
                    `));
                }
            }
        }
    } catch (e) { console.error("Reject email failed:", e); }

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

// ─── AI config actions ──────────────────────────────────────────

export async function getAiConfig() {
    await assertRoot();
    const { data, error } = await service
        .from("platform_config")
        .select("*")
        .eq("id", "main")
        .single();
    if (error) return { error: error.message };
    return { config: data };
}

export async function updateAiConfig(updates: {
    chat_model?: string;
    chat_model_label?: string;
    onboarding_model?: string;
    onboarding_model_label?: string;
    fallback_model?: string;
    fallback_model_label?: string;
}) {
    await assertRoot();
    const { error } = await service
        .from("platform_config")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", "main");
    if (error) return { error: error.message };
    revalidatePath("/root");
    return { ok: true };
}

// ─── Waitlist actions ────────────────────────────────────────────

function generateReferralKey(): string {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    const seg = (n: number) => Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    return `kb-${seg(4)}-${seg(4)}`;
}

export async function fetchWaitlist() {
    await assertRoot();
    const { data, error } = await service
        .from("waitlist")
        .select("*")
        .order("created_at", { ascending: false });
    if (error) return { error: error.message, entries: [] };
    return { entries: data || [] };
}

export async function approveWaitlistEntry(entryId: string) {
    await assertRoot();

    // Get entry
    const { data: entry, error: fetchErr } = await service
        .from("waitlist")
        .select("*")
        .eq("id", entryId)
        .single();

    if (fetchErr || !entry) return { error: "Entry not found" };
    if (entry.status === "approved") return { error: "Already approved" };

    // Update status
    await service.from("waitlist").update({
        status: "approved",
        approved_at: new Date().toISOString(),
    }).eq("id", entryId);

    // Find or create user profile to link referral keys
    const { data: profile } = await service
        .from("profiles")
        .select("id")
        .eq("email", entry.email)
        .maybeSingle();

    const userId = profile?.id || entryId; // fallback to entry id if no profile yet

    // Generate 5 referral keys
    const keys = Array.from({ length: 5 }, () => ({
        user_id: userId,
        key: generateReferralKey(),
    }));
    await service.from("referral_keys").insert(keys);

    // Send approved email
    try {
        const keyLinks = keys.map((k) => `<li style="margin:4px 0;"><a href="https://join.thekickback.net?ref=${k.key}" style="color:#F97316;text-decoration:none;font-family:monospace;">${k.key}</a></li>`).join("");
        sendEmail(entry.email, "You're in — welcome to theKickBack", wrap(`
            <div style="background:linear-gradient(135deg,rgba(249,115,22,0.15),rgba(249,115,22,0.05));border-radius:16px;padding:32px;text-align:center;margin-bottom:24px;">
                <div style="font-size:48px;margin-bottom:8px;">&#127881;</div>
                <h1 style="margin:0;font-size:28px;color:#F97316;">You're in.</h1>
            </div>
            <p style="color:rgba(255,255,255,0.7);font-size:15px;line-height:1.5;">
                Welcome to <strong style="color:#fff;">theKickBack</strong>. You've been approved — sign in and start exploring.
            </p>
            <div style="background:#111;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:16px;margin:16px 0;">
                <strong style="color:#F97316;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Your referral keys</strong>
                <p style="margin:8px 0 4px;color:rgba(255,255,255,0.5);font-size:13px;">Share these with 5 friends to let them skip the waitlist:</p>
                <ul style="list-style:none;padding:0;margin:0;">${keyLinks}</ul>
            </div>
            <div style="text-align:center;margin-top:24px;">
                <a href="https://join.thekickback.net" style="display:inline-block;background:#F97316;color:#000;padding:14px 32px;border-radius:12px;text-decoration:none;font-weight:600;font-size:15px;">Open theKickBack</a>
            </div>
        `));
    } catch (e) { console.error("Approve email failed:", e); }

    revalidatePath("/root");
    return { ok: true };
}

export async function rejectWaitlistEntry(entryId: string) {
    await assertRoot();

    const { data: entry, error: fetchErr } = await service
        .from("waitlist")
        .select("*")
        .eq("id", entryId)
        .single();

    if (fetchErr || !entry) return { error: "Entry not found" };

    await service.from("waitlist").update({ status: "rejected" }).eq("id", entryId);

    // Send rejection email
    try {
        sendEmail(entry.email, "theKickBack — update on your request", wrap(`
            <div style="background:linear-gradient(135deg,rgba(239,68,68,0.15),rgba(239,68,68,0.05));border-radius:16px;padding:32px;text-align:center;margin-bottom:24px;">
                <div style="font-size:48px;margin-bottom:8px;color:#EF4444;">!</div>
                <h1 style="margin:0;font-size:28px;color:#EF4444;">Not right now.</h1>
            </div>
            <p style="color:rgba(255,255,255,0.7);font-size:15px;line-height:1.5;">
                Thanks for your interest in theKickBack. We're not able to approve your access at this time, but we'll keep your email on file.
            </p>
            <p style="color:rgba(255,255,255,0.4);font-size:13px;margin-top:16px;">
                If you have a referral key from someone already on the platform, you can use that to get in.
            </p>
        `));
    } catch (e) { console.error("Reject email failed:", e); }

    revalidatePath("/root");
    return { ok: true };
}

// ─── Delete venue ───────────────────────────────────────────────

export async function deleteVenue(venuePageId: string, venueId: string) {
    await assertRoot();

    // Delete dependents first, then core records
    await service.from("venue_offerings").delete().eq("venue_id", venueId);
    await service.from("venue_knowledge").delete().eq("venue_id", venueId);
    await service.from("venue_xp_actions").delete().eq("venue_id", venueId);
    await service.from("venue_xp_milestones").delete().eq("venue_id", venueId);
    await service.from("venue_perks").delete().eq("venue_id", venueId);
    await service.from("venue_multipliers").delete().eq("venue_id", venueId);
    await service.from("venue_gallery").delete().eq("venue_id", venueId);
    await service.from("venue_staff").delete().eq("venue_id", venueId);
    await service.from("venue_owners").delete().eq("venue_id", venueId);
    await service.from("memberships").delete().eq("venue_id", venueId);
    await service.from("venue_pages").delete().eq("id", venuePageId);
    await service.from("venues").delete().eq("id", venueId);

    revalidatePath("/root");
    return { ok: true };
}
