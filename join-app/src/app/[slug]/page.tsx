import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { VenuePageClient } from "@/components/venue/venue-page-client";

const serviceClient = createServiceClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ table?: string; ref?: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const { data: page } = await serviceClient
    .from("venue_pages")
    .select("*, venues(*)")
    .eq("slug", slug)
    .eq("published", true)
    .single();

  if (!page) return { title: "Venue not found" };

  return {
    title: `${page.venues.name} — theKickBack`,
    description: page.tagline || page.description,
  };
}

export default async function VenuePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { table, ref } = await searchParams;

  const { data: page } = await serviceClient
    .from("venue_pages")
    .select("*, venues(*)")
    .eq("slug", slug)
    .eq("published", true)
    .single();

  if (!page) notFound();

  // Fetch active offerings for this venue
  const { data: offerings } = await serviceClient
    .from("venue_offerings")
    .select("id, type, name, description, price_cents, recurring, interval, perks, active")
    .eq("venue_id", page.venues.id)
    .eq("active", true)
    .order("sort_order", { ascending: true });

  // Fetch gallery images
  const { data: gallery } = await serviceClient
    .from("venue_gallery")
    .select("id, image_url, caption, sort_order")
    .eq("venue_id", page.venues.id)
    .order("sort_order", { ascending: true });

  // Fetch visible staff members
  const { data: staff } = await serviceClient
    .from("venue_staff")
    .select("id, display_name, role_title, avatar_url, bio, specialties, schedule")
    .eq("venue_id", page.venues.id)
    .eq("visible", true)
    .order("sort_order", { ascending: true });

  // Check if the current user is authenticated
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <VenuePageClient
      page={page}
      venue={page.venues}
      table={table}
      ref={ref}
      user={user ? { id: user.id, email: user.email ?? "" } : null}
      offerings={offerings || []}
      gallery={gallery || []}
      staff={staff || []}
    />
  );
}
