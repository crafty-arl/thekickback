import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { ScannerClient } from "./scanner-client";

export default async function ScanPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const service = createServiceClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );

  // Check if user is owner or staff
  const { data: ownership } = await service
    .from("venue_owners")
    .select("venue_id, venues(id, name)")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  let venueId = "";
  let venueName = "";

  if (ownership) {
    const v = ownership.venues as unknown as { id: string; name: string };
    venueId = v.id;
    venueName = v.name;
  } else {
    // Check staff
    const { data: staff } = await service
      .from("venue_staff")
      .select("venue_id, venues(id, name)")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (staff) {
      const v = (staff as unknown as { venues: { id: string; name: string } }).venues;
      venueId = v.id;
      venueName = v.name;
    }
  }

  if (!venueId) redirect("/");

  return <ScannerClient venueId={venueId} venueName={venueName} />;
}
