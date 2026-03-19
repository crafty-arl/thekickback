import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

interface ExtractedPref {
  category: string;
  key: string;
  value: string;
}

/**
 * Extract preferences from a conversation exchange using AI.
 * Runs async — fire and forget after the chat response is sent.
 */
export async function extractPreferences(
  userId: string,
  userMessage: string,
  aiReply: string,
  venueId: string | null,
  venueName?: string
): Promise<void> {
  // Skip short messages and common commands
  if (userMessage.length < 12) return;
  const lower = userMessage.toLowerCase();
  if (["menu", "vibe", "events", "reserve", "status"].includes(lower.trim())) return;

  try {
    const res = await fetch(`${process.env.OPENCLAW_GATEWAY_URL}/v1/responses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENCLAW_GATEWAY_TOKEN}`,
        "Content-Type": "application/json",
        "x-openclaw-agent-id": "preference-extractor",
      },
      body: JSON.stringify({
        model: "openclaw",
        input: [
          "Extract user preferences from this conversation. Return ONLY a valid JSON array.",
          "If no preferences found, return [].",
          "",
          "Categories and key formats:",
          '  dietary: {"category":"dietary","key":"diet:vegan","value":"true"}',
          '  vibe: {"category":"vibe","key":"prefers:quiet","value":"true"}',
          '  venue_type: {"category":"venue_type","key":"likes:cafe","value":"true"}',
          '  group_size: {"category":"group_size","key":"usual_size","value":"2-4"}',
          '  time: {"category":"time","key":"prefers:evening","value":"true"}',
          '  order: {"category":"order","key":"usual:' + (venueName || "general") + '","value":"cortado with oat milk"}',
          '  neighborhood: {"category":"neighborhood","key":"likes:east-side","value":"true"}',
          '  interest: {"category":"interest","key":"into:live-music","value":"true"}',
          '  general: {"category":"general","key":"note","value":"free text observation"}',
          "",
          "Rules:",
          "- Only extract CLEAR preferences the user explicitly stated or strongly implied.",
          '- "I\'m meeting my vegan friend" does NOT mean the user is vegan.',
          '- "I love this place" at a cafe DOES imply they like cafes.',
          "- Orders/requests at a specific venue are venue-specific preferences.",
          "- Be conservative. When in doubt, don't extract.",
          "",
          `User said: "${userMessage}"`,
          `AI replied: "${aiReply}"`,
          venueId ? `At venue: ${venueName} (${venueId})` : "In the master concierge chat.",
          "",
          "Return ONLY the JSON array. No explanation. No markdown.",
        ].join("\n"),
      }),
    });

    if (!res.ok) return;

    const data = await res.json();
    const msg = data.output?.find((o: { type: string }) => o.type === "message");
    const text = msg?.content?.find((c: { type: string; text?: string }) => c.type === "output_text")?.text;
    if (!text) return;

    // Parse the JSON array from the response
    const cleaned = text.trim().replace(/^```json?\n?/, "").replace(/\n?```$/, "");
    let prefs: ExtractedPref[];
    try {
      prefs = JSON.parse(cleaned);
    } catch {
      return;
    }

    if (!Array.isArray(prefs) || prefs.length === 0) return;

    // Upsert each preference
    for (const pref of prefs.slice(0, 5)) {
      if (!pref.category || !pref.key || !pref.value) continue;

      // Determine if this is venue-specific or global
      const isVenueSpecific = pref.category === "order" && venueId;

      await supabase.rpc("upsert_preference", {
        p_user_id: userId,
        p_category: pref.category,
        p_key: pref.key,
        p_value: pref.value,
        p_confidence: 0.5,
        p_source: "ai",
        p_venue_id: isVenueSpecific ? venueId : null,
      });
    }
  } catch (err) {
    console.error("Preference extraction error:", err);
  }
}

/**
 * Load user preferences and format them for AI prompt injection.
 */
export async function getPreferencesContext(
  userId: string,
  venueId?: string
): Promise<string> {
  const queries = [
    // Global preferences
    supabase
      .from("user_preferences")
      .select("category, key, value")
      .eq("user_id", userId)
      .is("venue_id", null)
      .gte("confidence", 0.3)
      .order("confidence", { ascending: false })
      .limit(10),
  ];

  // Venue-specific preferences
  if (venueId) {
    queries.push(
      supabase
        .from("user_preferences")
        .select("category, key, value")
        .eq("user_id", userId)
        .eq("venue_id", venueId)
        .gte("confidence", 0.3)
        .order("confidence", { ascending: false })
        .limit(5)
    );
  }

  const results = await Promise.all(queries);
  const globalPrefs = results[0].data || [];
  const venuePrefs = results[1]?.data || [];

  if (globalPrefs.length === 0 && venuePrefs.length === 0) return "";

  const lines: string[] = ["\nAbout this guest:"];

  const CATEGORY_LABELS: Record<string, string> = {
    dietary: "Dietary",
    vibe: "Vibe preference",
    venue_type: "Venue preference",
    group_size: "Group size",
    time: "Time preference",
    order: "Usual order",
    neighborhood: "Neighborhood",
    interest: "Interest",
    general: "Note",
  };

  for (const p of globalPrefs) {
    lines.push(`- ${CATEGORY_LABELS[p.category] || p.category}: ${p.value}`);
  }

  if (venuePrefs.length > 0) {
    lines.push("At this venue specifically:");
    for (const p of venuePrefs) {
      lines.push(`- ${CATEGORY_LABELS[p.category] || p.category}: ${p.value}`);
    }
  }

  lines.push("Use this to personalize. Don't announce what you know — just be naturally helpful.");

  return lines.join("\n");
}
