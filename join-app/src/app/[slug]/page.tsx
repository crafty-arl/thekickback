import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import { VenuePageClient } from "@/components/venue/venue-page-client";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ table?: string; ref?: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const { data: page } = await supabase
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

  const { data: page } = await supabase
    .from("venue_pages")
    .select("*, venues(*)")
    .eq("slug", slug)
    .eq("published", true)
    .single();

  if (!page) notFound();

  return (
    <VenuePageClient
      page={page}
      venue={page.venues}
      table={table}
      ref={ref}
    />
  );
}
