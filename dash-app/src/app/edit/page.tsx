import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as createService } from "@supabase/supabase-js";
import { EditForm } from "./edit-form";

export default async function EditPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const service = createService(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );

  const { data: ownership } = await service
    .from("venue_owners")
    .select("venue_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!ownership) redirect("/onboarding");

  const { data: venue } = await service
    .from("venues")
    .select("*")
    .eq("id", ownership.venue_id)
    .single();

  const { data: page } = await service
    .from("venue_pages")
    .select("*")
    .eq("venue_id", ownership.venue_id)
    .single();

  return <EditForm venue={venue} page={page} />;
}
