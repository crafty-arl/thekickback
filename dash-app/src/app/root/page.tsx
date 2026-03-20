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
        return <RootClient pages={[]} orphanVenues={[]} stats={null} authed={false} />;
    }

    // Verify the cookie matches a valid admin session
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !user.email) {
        return <RootClient pages={[]} orphanVenues={[]} stats={null} authed={false} />;
    }

    // Admin is authed + has root cookie — fetch platform data
    const service = createService(
        process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_KEY!,
    );

    const [pagesRes, allVenuesRes, memberCountRes, sessionCountRes, knowledgeCountRes, offeringCountRes, configRes] = await Promise.all([
        service.from("venue_pages").select("*, venues(id, name, type, address, neighborhood, lat, lng, max_occupancy)").order("created_at", { ascending: false }),
        service.from("venues").select("id, name, type, address, neighborhood, lat, lng, max_occupancy, state, vibe, occupancy, created_at").order("created_at", { ascending: false }),
        service.from("memberships").select("id", { count: "exact", head: true }),
        service.from("sessions").select("id", { count: "exact", head: true }),
        service.from("venue_knowledge").select("id", { count: "exact", head: true }),
        service.from("venue_offerings").select("id", { count: "exact", head: true }),
        service.from("platform_config").select("*").eq("id", "main").single(),
    ]);

    const pages = pagesRes.data || [];
    const allVenues = allVenuesRes.data || [];

    // Find orphan venues (in venues table but missing from venue_pages)
    const pagedVenueIds = new Set(pages.map((p: Record<string, unknown>) => {
        const v = p.venues as Record<string, unknown> | null;
        return v?.id;
    }).filter(Boolean));

    const orphanVenues = allVenues.filter((v: Record<string, unknown>) => !pagedVenueIds.has(v.id));

    const stats = {
        totalVenues: pages.length + orphanVenues.length,
        pendingVenues: pages.filter((p: Record<string, unknown>) => p.review_status === "pending").length,
        publishedVenues: pages.filter((p: Record<string, unknown>) => p.published).length,
        orphanVenues: orphanVenues.length,
        totalMembers: memberCountRes.count || 0,
        totalSessions: sessionCountRes.count || 0,
        totalKnowledge: knowledgeCountRes.count || 0,
        totalOfferings: offeringCountRes.count || 0,
    };

    const aiConfig = configRes.data || null;

    return <RootClient pages={pages} orphanVenues={orphanVenues} stats={stats} authed={true} aiConfig={aiConfig} />;
}
