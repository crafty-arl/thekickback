-- Self-service check-in system
-- Guests scan on-premise QR codes to check in and earn XP

create table if not exists checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  venue_id uuid not null references venues(id) on delete cascade,
  session_id uuid references sessions(id) on delete set null,
  table_number text,
  source text not null default 'qr',
  xp_granted integer not null default 0,
  receipt_image_url text,
  receipt_total_cents integer,
  receipt_items jsonb,
  receipt_xp_granted integer default 0,
  receipt_status text default null check (receipt_status in ('pending', 'verified', 'rejected')),
  created_at timestamptz not null default now()
);

create index idx_checkins_venue on checkins(venue_id, created_at desc);
create index idx_checkins_user on checkins(user_id, venue_id, created_at desc);

alter table checkins enable row level security;

create policy "users_read_own_checkins" on checkins
  for select using (user_id = auth.uid());

create policy "service_manage_checkins" on checkins
  for all using (true) with check (true);

-- Storage bucket for receipt photos (create via Supabase dashboard or CLI)
-- insert into storage.buckets (id, name, public) values ('receipts', 'receipts', true);
