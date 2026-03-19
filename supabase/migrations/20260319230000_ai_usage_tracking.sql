-- AI usage tracking per guest per venue
-- Venues can set a free message limit; after that, membership is required

-- ─── Usage log (one row per guest per venue per day) ─────────────
create table if not exists ai_usage (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references venues(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  device_id text, -- fallback fingerprint for anonymous guests
  message_count int not null default 1,
  date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (venue_id, user_id, date),
  unique (venue_id, device_id, date)
);

-- ─── Venue AI limits config ──────────────────────────────────────
-- One row per venue. If no row exists, no limit is enforced.
create table if not exists venue_ai_limits (
  venue_id uuid primary key references venues(id) on delete cascade,
  free_messages_per_day int not null default 10,
  require_membership boolean not null default false,
  gate_message text not null default 'You''ve used your free messages for today. Sign up to keep chatting!',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── Increment usage and return new count ────────────────────────
create or replace function increment_ai_usage(
  p_venue_id uuid,
  p_user_id uuid default null,
  p_device_id text default null
) returns int as $$
declare
  new_count int;
begin
  if p_user_id is not null then
    insert into ai_usage (venue_id, user_id, date, message_count)
    values (p_venue_id, p_user_id, current_date, 1)
    on conflict (venue_id, user_id, date)
    do update set message_count = ai_usage.message_count + 1, updated_at = now()
    returning message_count into new_count;
  elsif p_device_id is not null then
    insert into ai_usage (venue_id, device_id, date, message_count)
    values (p_venue_id, p_device_id, current_date, 1)
    on conflict (venue_id, device_id, date)
    do update set message_count = ai_usage.message_count + 1, updated_at = now()
    returning message_count into new_count;
  else
    return 0; -- no identity, can't track
  end if;
  return new_count;
end;
$$ language plpgsql security definer;

-- ─── Check if guest has a membership at this venue ───────────────
create or replace function has_venue_membership(
  p_user_id uuid,
  p_venue_id uuid
) returns boolean as $$
begin
  return exists (
    select 1 from memberships
    where user_id = p_user_id
      and venue_id = p_venue_id
      and (expires_at is null or expires_at > now())
  );
end;
$$ language plpgsql security definer;

-- ─── RLS ─────────────────────────────────────────────────────────
alter table ai_usage enable row level security;
alter table venue_ai_limits enable row level security;

-- Venue owners can read their own usage data
create policy "venue_owners_read_usage" on ai_usage
  for select using (
    venue_id in (select venue_id from venue_owners where user_id = auth.uid())
  );

-- Venue owners can manage their limits
create policy "venue_owners_manage_limits" on venue_ai_limits
  for all using (
    venue_id in (select venue_id from venue_owners where user_id = auth.uid())
  );

-- Service role can do everything (API routes use service key)

-- ─── Index for fast lookups ──────────────────────────────────────
create index if not exists idx_ai_usage_venue_date on ai_usage (venue_id, date);
create index if not exists idx_ai_usage_user_date on ai_usage (user_id, date) where user_id is not null;
