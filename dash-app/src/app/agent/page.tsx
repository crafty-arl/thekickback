import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as createService } from "@supabase/supabase-js";
import { AgentEditor } from "./agent-editor";

export default async function AgentPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const service = createService(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

  const { data: ownership } = await service
    .from("venue_owners")
    .select("venue_id, venues(id, name)")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!ownership) redirect("/onboarding");

  const venue = ownership.venues as unknown as { id: string; name: string };

  const { data: knowledge } = await service
    .from("venue_knowledge")
    .select("id, content, category, created_at")
    .eq("venue_id", venue.id)
    .order("category")
    .order("created_at", { ascending: false });

  return <AgentEditor venueName={venue.name} knowledge={knowledge || []} />;
}
