import { createClient } from "@/lib/supabase/server";
import { createClient as createService } from "@supabase/supabase-js";
import { RootClient } from "./root-client";

const ROOT_EMAILS = ["carl@craftthefuture.xyz"];

export default async function RootPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Not logged in or not an admin → show OTP gate
    if (!user || !user.email || !ROOT_EMAILS.includes(user.email)) {
        return <RootClient pages={[]} stats={null} authed={false} />;
    }

    // Admin is authed — fetch platform data
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
