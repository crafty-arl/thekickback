"use server";

import { createClient as createAuthClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

const CF_ACCOUNT_ID = "6c235bb622d4bca66876392df398234b";
const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN || "";

const service = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
);

async function getVenueId(): Promise<string | null> {
  const supabase = await createAuthClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await service
    .from("venue_owners")
    .select("venue_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  return data?.venue_id || null;
}

async function generateEmbedding(text: string): Promise<number[] | null> {
  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run/@cf/baai/bge-base-en-v1.5`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${CF_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: [text] }),
      }
    );
    if (!res.ok) { console.error("Embedding error:", await res.text()); return null; }
    const data = await res.json() as { result?: { data?: number[][] } };
    return data.result?.data?.[0] || null;
  } catch (err) {
    console.error("Embedding fetch error:", err);
    return null;
  }
}

export async function addKnowledge(content: string, category: string) {
  const venueId = await getVenueId();
  if (!venueId) return { error: "Not authenticated" };
  if (!content.trim()) return { error: "Content is empty" };

  const embedding = await generateEmbedding(content);

  const { error } = await service.from("venue_knowledge").insert({
    venue_id: venueId,
    content: content.trim(),
    category,
    embedding: embedding ? `[${embedding.join(",")}]` : null,
  });

  if (error) return { error: error.message };
  revalidatePath("/agent");
  return { ok: true };
}

export async function deleteKnowledge(id: string) {
  const venueId = await getVenueId();
  if (!venueId) return { error: "Not authenticated" };

  const { error } = await service
    .from("venue_knowledge")
    .delete()
    .eq("id", id)
    .eq("venue_id", venueId);

  if (error) return { error: error.message };
  revalidatePath("/agent");
  return { ok: true };
}

export async function updateKnowledge(id: string, content: string, category: string) {
  const venueId = await getVenueId();
  if (!venueId) return { error: "Not authenticated" };

  const embedding = await generateEmbedding(content);

  const { error } = await service
    .from("venue_knowledge")
    .update({
      content: content.trim(),
      category,
      embedding: embedding ? `[${embedding.join(",")}]` : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("venue_id", venueId);

  if (error) return { error: error.message };
  revalidatePath("/agent");
  return { ok: true };
}
