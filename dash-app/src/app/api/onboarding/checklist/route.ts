import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

function getService() {
  return createServiceClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );
}

async function getAuthVenue() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await getService()
    .from("venue_owners")
    .select("venue_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!data) return null;
  return { userId: user.id, venueId: data.venue_id };
}

const CHECKLIST_ITEMS = ["basics", "location", "hours", "branding", "offerings", "knowledge", "photos", "xp", "stripe"] as const;

export async function GET() {
  const auth = await getAuthVenue();
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: page } = await getService()
    .from("venue_pages")
    .select("onboarding_checklist, slug, tagline, description, theme_color, hours, review_status")
    .eq("venue_id", auth.venueId)
    .single();

  const { data: venue } = await getService()
    .from("venues")
    .select("name, type, address, neighborhood")
    .eq("id", auth.venueId)
    .single();

  const checklist = page?.onboarding_checklist || {};
  const completed = CHECKLIST_ITEMS.filter((k) => checklist[k] === true).length;
  const percentComplete = Math.round((completed / CHECKLIST_ITEMS.length) * 100);

  return NextResponse.json({
    checklist,
    percentComplete,
    completed,
    total: CHECKLIST_ITEMS.length,
    venueId: auth.venueId,
    venue,
    page: page ? { slug: page.slug, tagline: page.tagline, description: page.description, theme_color: page.theme_color, hours: page.hours, review_status: page.review_status } : null,
  });
}

export async function PATCH(request: NextRequest) {
  const auth = await getAuthVenue();
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json() as { item: string; completed: boolean };
  if (!CHECKLIST_ITEMS.includes(body.item as typeof CHECKLIST_ITEMS[number])) {
    return NextResponse.json({ error: "Invalid checklist item" }, { status: 400 });
  }

  // Get current checklist
  const { data: page } = await getService()
    .from("venue_pages")
    .select("onboarding_checklist")
    .eq("venue_id", auth.venueId)
    .single();

  const checklist = page?.onboarding_checklist || {};
  checklist[body.item] = body.completed;

  const { error } = await getService()
    .from("venue_pages")
    .update({ onboarding_checklist: checklist })
    .eq("venue_id", auth.venueId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const completed = CHECKLIST_ITEMS.filter((k) => checklist[k] === true).length;
  const percentComplete = Math.round((completed / CHECKLIST_ITEMS.length) * 100);

  return NextResponse.json({ checklist, percentComplete, completed, total: CHECKLIST_ITEMS.length });
}
