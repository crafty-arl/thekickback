import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { CheckinClient } from "./checkin-client";

const service = createServiceClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

interface Props {
  params: Promise<{ venueId: string }>;
  searchParams: Promise<{ table?: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { venueId } = await params;
  const { data: venue } = await service
    .from("venues")
    .select("name")
    .eq("id", venueId)
    .eq("state", "active")
    .single();

  if (!venue) return { title: "Check In — theKickBack" };
  return { title: `${venue.name} — Check In` };
}

export default async function CheckinPage({ params, searchParams }: Props) {
  const { venueId } = await params;
  const { table } = await searchParams;

  // Fetch venue
  const { data: venue } = await service
    .from("venues")
    .select("id, name, state, vibe")
    .eq("id", venueId)
    .eq("state", "active")
    .single();

  if (!venue) notFound();

  // Fetch venue page for theme color
  const { data: page } = await service
    .from("venue_pages")
    .select("theme_color, tagline, slug")
    .eq("venue_id", venueId)
    .single();

  // Fetch XP actions and milestones
  const [actionsRes, milestonesRes] = await Promise.all([
    service.from("venue_xp_actions").select("action, label, points").eq("venue_id", venueId).eq("active", true),
    service.from("venue_xp_milestones").select("id, name, threshold, color, reward, perks").eq("venue_id", venueId).order("threshold"),
  ]);

  // Check auth
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <CheckinClient
      venue={venue}
      themeColor={page?.theme_color || "#F97316"}
      tagline={page?.tagline || null}
      slug={page?.slug || null}
      table={table || null}
      user={user ? { id: user.id, email: user.email || "" } : null}
      xpActions={actionsRes.data || []}
      milestones={milestonesRes.data || []}
    />
  );
}
