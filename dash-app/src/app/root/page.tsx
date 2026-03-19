import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createClient as createService } from "@supabase/supabase-js";
import { RootClient } from "./root-client";

export default async function RootPage() {
    // Check for root access cookie (set after OTP verification at /root)
    const cookieStore = await cookies();
    const rootToken = cookieStore.get("root_access")?.value;

    if (!rootToken) {
        // No root cookie → show OTP gate (regardless of dashboard session)
        return <RootClient pages={[]} stats={null} authed={false} />;
    }

    // Verify the cookie matches a valid admin session
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !user.email) {
        return <RootClient pages={[]} stats={null} authed={false} />;
    }

    // Admin is authed + has root cookie — fetch platform data
    const service = createService(
        process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_KEY!,
    );

    const [pagesRes, memberCountRes, sessionCountRes, knowledgeCountRes, offeringCountRes] = await Promise.all([
        service.from("venue_pages").select("*, venues(id, name, type, address, max_occupancy)").order("created_at", { ascending: false }),
        service.from("memberships").select("id", { count: "exact", head: true }),
        service.from("sessions").select("id", { count: "exact", head: true }),
        service.from("venue_knowledge").select("id", { count: "exact", head: true }),
        service.from("venue_offerings").select("id", { count: "exact", head: true }),
    ]);

    const pages = pagesRes.data || [];

    const stats = {
        totalVenues: pages.length,
        pendingVenues: pages.filter((p) => p.review_status === "pending").length,
        publishedVenues: pages.filter((p) => p.published).length,
        totalMembers: memberCountRes.count || 0,
        totalSessions: sessionCountRes.count || 0,
        totalKnowledge: knowledgeCountRes.count || 0,
        totalOfferings: offeringCountRes.count || 0,
    };

    return <RootClient pages={pages} stats={stats} authed={true} />;
}
