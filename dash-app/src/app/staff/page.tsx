import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { StaffPortalClient } from "./staff-portal-client";

export default async function StaffPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const service = createServiceClient(
        process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_KEY!,
    );

    // Get staff profile for this user
    const { data: staffProfile } = await service
        .from("venue_staff")
        .select("id, venue_id, display_name, role_title, avatar_url, bio, specialties, visible, schedule, email, invite_status")
        .eq("user_id", user.id)
        .limit(1)
        .single();

    if (!staffProfile) redirect("/");

    // Get venue info
    const { data: venue } = await service
        .from("venues")
        .select("id, name, type")
        .eq("id", staffProfile.venue_id)
        .single();

    if (!venue) redirect("/");

    return (
        <StaffPortalClient
            profile={staffProfile}
            venue={venue}
            userEmail={user.email || ""}
        />
    );
}
