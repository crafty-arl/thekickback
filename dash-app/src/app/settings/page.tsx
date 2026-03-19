import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as createService } from "@supabase/supabase-js";
import { SettingsClient } from "./settings-client";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const service = createService(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );

  // Get venue ownership
  const { data: ownership } = await service
    .from("venue_owners")
    .select("venue_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!ownership) redirect("/onboarding");

  // Parallel fetch all data
  const [venueRes, pageRes, knowledgeRes, membersRes, memberCountRes, offeringsRes] = await Promise.all([
    service.from("venues").select("*").eq("id", ownership.venue_id).single(),
    service.from("venue_pages").select("*").eq("venue_id", ownership.venue_id).single(),
    service.from("venue_knowledge").select("id, content, category, created_at").eq("venue_id", ownership.venue_id).order("created_at", { ascending: false }),
    service.from("memberships").select("id, user_id, tier, created_at, profiles(phone, email, display_name)").eq("venue_id", ownership.venue_id).order("created_at", { ascending: false }).limit(50),
    service.from("memberships").select("id", { count: "exact", head: true }).eq("venue_id", ownership.venue_id),
    service.from("venue_offerings").select("*").eq("venue_id", ownership.venue_id).order("sort_order", { ascending: true }),
  ]);

  const venue = venueRes.data;
  if (!venue) redirect("/onboarding");

  // Transform members (Supabase returns profiles as array from join)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const members = (membersRes.data || []).map((m: any) => ({
    id: m.id,
    user_id: m.user_id,
    tier: m.tier,
    created_at: m.created_at,
    profiles: Array.isArray(m.profiles) ? m.profiles[0] : m.profiles,
  }));

  return (
    <SettingsClient
      user={{ id: user.id, email: user.email || "" }}
      role={ownership.role}
      venue={venue}
      page={pageRes.data}
      knowledge={knowledgeRes.data || []}
      members={members}
      memberCount={memberCountRes.count || 0}
      offerings={offeringsRes.data || []}
    />
  );
}
