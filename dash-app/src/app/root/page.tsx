import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as createService } from "@supabase/supabase-js";
import { RootClient } from "./root-client";

export default async function RootPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const service = createService(
        process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_KEY!,
    );

    // Parallel fetch: all venue pages + counts
    const [
        pagesRes,
        memberCountRes,
        sessionCountRes,
        knowledgeCountRes,
        offeringCountRes,
    ] = await Promise.all([
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

    return <RootClient pages={pages} stats={stats} />;
}
