-- Platform-level configuration (singleton row)
create table if not exists platform_config (
  id text primary key default 'main',
  -- AI model settings
  chat_model text not null default 'openclaw',
  chat_model_label text not null default 'OpenClaw (default)',
  onboarding_model text not null default '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  onboarding_model_label text not null default 'Llama 3.3 70B (Cloudflare)',
  fallback_model text not null default '@cf/meta/llama-3.2-3b-instruct',
  fallback_model_label text not null default 'Llama 3.2 3B (Cloudflare)',
  -- Model options (JSON array of available models)
  available_chat_models jsonb not null default '[
    {"id":"openclaw","label":"OpenClaw (default)","provider":"openclaw"},
    {"id":"@cf/meta/llama-3.3-70b-instruct-fp8-fast","label":"Llama 3.3 70B","provider":"cloudflare"},
    {"id":"@cf/meta/llama-3.2-3b-instruct","label":"Llama 3.2 3B","provider":"cloudflare"},
    {"id":"@cf/deepseek-ai/deepseek-r1-distill-qwen-32b","label":"DeepSeek R1 32B","provider":"cloudflare"},
    {"id":"@cf/meta/llama-3.1-8b-instruct","label":"Llama 3.1 8B","provider":"cloudflare"}
  ]'::jsonb,
  available_onboarding_models jsonb not null default '[
    {"id":"@cf/meta/llama-3.3-70b-instruct-fp8-fast","label":"Llama 3.3 70B","provider":"cloudflare"},
    {"id":"@cf/meta/llama-3.2-3b-instruct","label":"Llama 3.2 3B","provider":"cloudflare"},
    {"id":"openclaw","label":"OpenClaw","provider":"openclaw"}
  ]'::jsonb,
  updated_at timestamptz not null default now()
);

-- Insert default config
insert into platform_config (id) values ('main') on conflict do nothing;
