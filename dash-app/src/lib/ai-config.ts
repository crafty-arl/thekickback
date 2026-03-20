import { createClient } from "@supabase/supabase-js";

interface AiConfig {
  chat_model: string;
  onboarding_model: string;
  fallback_model: string;
}

const defaults: AiConfig = {
  chat_model: "openclaw",
  onboarding_model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  fallback_model: "@cf/meta/llama-3.2-3b-instruct",
};

export async function getAiConfig(): Promise<AiConfig> {
  try {
    const service = createClient(
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!,
    );
    const { data } = await service
      .from("platform_config")
      .select("chat_model, onboarding_model, fallback_model")
      .eq("id", "main")
      .single();
    if (data) return data as AiConfig;
  } catch {
    // Fall through to defaults
  }
  return defaults;
}
