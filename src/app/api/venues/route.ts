import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET() {
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;

    if (!url || !key) {
        return Response.json({ venues: [] });
    }

    try {
        const supabase = createClient(url, key);

        const { data: pages, error } = await supabase
            .from("venue_pages")
            .select(`
        slug,
        venues (
          id, name, type, neighborhood,
          latitude, longitude, lat, lng,
          vibe, occupancy, max_occupancy
        )
      `)
            .eq("published", true)
            .eq("review_status", "approved");

        if (error || !pages) {
            console.error("[/api/venues]", error?.message);
            return Response.json({ venues: [] });
        }

        const venues = pages
            .filter((p: Record<string, unknown>) => {
                const v = p.venues as Record<string, unknown> | null;
                if (!v) return false;
                return (typeof v.latitude === "number" && typeof v.longitude === "number")
                    || (typeof v.lat === "number" && typeof v.lng === "number");
            })
            .map((p: Record<string, unknown>) => {
                const v = p.venues as Record<string, unknown>;
                return {
                    id: v.id as string,
                    name: v.name as string,
                    slug: p.slug as string,
                    type: (v.type as string) || "venue",
                    neighborhood: (v.neighborhood as string) || "",
                    vibe: (v.vibe as string) || "quiet",
                    lat: (v.latitude as number) || (v.lat as number),
                    lng: (v.longitude as number) || (v.lng as number),
                };
            });

        return Response.json(
            { venues },
            { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } }
        );
    } catch (err) {
        console.error("[/api/venues]", err);
        return Response.json({ venues: [] });
    }
}
