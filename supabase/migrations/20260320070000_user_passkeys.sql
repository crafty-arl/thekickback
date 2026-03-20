-- User passkeys for WebAuthn biometric purchase verification
create table if not exists user_passkeys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  credential_id text not null unique,
  public_key text not null,
  counter bigint not null default 0,
  device_name text,
  transports text[], -- e.g. ['internal', 'hybrid']
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists idx_user_passkeys_user on user_passkeys(user_id);
create index if not exists idx_user_passkeys_cred on user_passkeys(credential_id);

-- Challenges table for replay protection
create table if not exists passkey_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  challenge text not null,
  purpose text not null default 'verify', -- 'register' or 'verify'
  expires_at timestamptz not null default (now() + interval '5 minutes'),
  used boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_passkey_challenges_user on passkey_challenges(user_id);

-- RLS
alter table user_passkeys enable row level security;
alter table passkey_challenges enable row level security;

create policy "Users can read own passkeys"
  on user_passkeys for select using (auth.uid() = user_id);

create policy "Users can insert own passkeys"
  on user_passkeys for insert with check (auth.uid() = user_id);

create policy "Users can delete own passkeys"
  on user_passkeys for delete using (auth.uid() = user_id);

create policy "Users can read own challenges"
  on passkey_challenges for select using (auth.uid() = user_id);
