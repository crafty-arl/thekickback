-- XP Roadmaps: venue-specific progression systems
-- Venue owners define what actions earn XP and what milestones unlock rewards

-- Actions that earn XP at a venue
create table if not exists venue_xp_actions (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references venues(id) on delete cascade,
  action text not null,  -- e.g. 'visit', 'order', 'referral', 'event_attend', 'review', 'custom'
  label text not null,   -- display name, e.g. "First Visit", "Place an Order"
  points integer not null default 10,
  description text,      -- optional: "Earn 50 XP every time you visit"
  max_per_day integer,   -- null = unlimited
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index idx_venue_xp_actions_venue on venue_xp_actions(venue_id);

-- Milestones in the XP roadmap (venue-specific tiers)
create table if not exists venue_xp_milestones (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references venues(id) on delete cascade,
  name text not null,         -- e.g. "Regular", "VIP", "Legend"
  threshold integer not null, -- XP needed to reach this milestone
  color text not null default '#F97316',  -- display color
  reward text,                -- what the guest unlocks, e.g. "Free coffee on every visit"
  perks text[] not null default '{}',     -- list of perk descriptions
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index idx_venue_xp_milestones_venue on venue_xp_milestones(venue_id);

-- RLS
alter table venue_xp_actions enable row level security;
alter table venue_xp_milestones enable row level security;

-- Venue owners manage their own roadmaps
create policy "owners_manage_xp_actions" on venue_xp_actions
  for all using (
    venue_id in (select venue_id from venue_owners where user_id = auth.uid())
  );

create policy "owners_manage_xp_milestones" on venue_xp_milestones
  for all using (
    venue_id in (select venue_id from venue_owners where user_id = auth.uid())
  );

-- Anyone can read (guests see the roadmap)
create policy "public_read_xp_actions" on venue_xp_actions
  for select using (true);

create policy "public_read_xp_milestones" on venue_xp_milestones
  for select using (true);
