import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createService } from "@supabase/supabase-js";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { venueId } = await req.json();
  if (!venueId) return NextResponse.json({ error: "Missing venueId" }, { status: 400 });

  const service = createService(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );

  // Verify ownership
  const { data: ownership } = await service
    .from("venue_owners")
    .select("venue_id")
    .eq("user_id", user.id)
    .eq("venue_id", venueId)
    .single();

  if (!ownership) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  // Reset venue page to blank
  await service
    .from("venue_pages")
    .update({
      tagline: null,
      description: null,
      theme_color: "#F97316",
      hours: null,
      hero_image: null,
      review_status: "draft",
      published: false,
      onboarding_checklist: null,
    })
    .eq("venue_id", venueId);

  // Set venue inactive
  await service
    .from("venues")
    .update({ state: "inactive" })
    .eq("id", venueId);

  // Delete all offerings
  await service
    .from("venue_offerings")
    .delete()
    .eq("venue_id", venueId);

  // Delete gallery images
  await service
    .from("venue_gallery")
    .delete()
    .eq("venue_id", venueId);

  // Delete XP actions and milestones
  await Promise.all([
    service.from("venue_xp_actions").delete().eq("venue_id", venueId),
    service.from("venue_xp_milestones").delete().eq("venue_id", venueId),
    service.from("venue_knowledge").delete().eq("venue_id", venueId),
  ]);

  return NextResponse.json({ ok: true });
}
