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

-- Saved custom templates per venue
create table if not exists venue_xp_templates (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references venues(id) on delete cascade,
  name text not null,
  actions jsonb not null default '[]',
  milestones jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (venue_id, name)
);

alter table venue_xp_templates enable row level security;

create policy "owners_manage_xp_templates" on venue_xp_templates
  for all using (
    venue_id in (select venue_id from venue_owners where user_id = auth.uid())
  );

-- ─── Per-Venue User XP (each user has a separate XP profile at each venue) ───

create table if not exists user_venue_xp (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  venue_id uuid not null references venues(id) on delete cascade,
  xp integer not null default 0,
  milestone_id uuid references venue_xp_milestones(id) on delete set null,
  -- current highest milestone reached
  visits integer not null default 0,
  last_visit_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, venue_id)
);

create index idx_user_venue_xp_user on user_venue_xp(user_id);
create index idx_user_venue_xp_venue on user_venue_xp(venue_id, xp desc);

alter table user_venue_xp enable row level security;

create policy "users_read_own_venue_xp" on user_venue_xp
  for select using (user_id = (
    select id from profiles where phone = (select auth.jwt() ->> 'phone')
  ));

create policy "service_manage_venue_xp" on user_venue_xp
  for all using (true) with check (true);

-- ─── Per-Venue XP Ledger (tracks each XP event at a venue) ──────

create table if not exists venue_xp_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  venue_id uuid not null references venues(id) on delete cascade,
  xp_action_id uuid references venue_xp_actions(id) on delete set null,
  amount integer not null,
  reason text not null, -- matches xp_action.action or 'bonus'
  created_at timestamptz not null default now()
);

create index idx_venue_xp_ledger_user_venue on venue_xp_ledger(user_id, venue_id, created_at desc);

alter table venue_xp_ledger enable row level security;

create policy "users_read_own_xp_ledger" on venue_xp_ledger
  for select using (user_id = (
    select id from profiles where phone = (select auth.jwt() ->> 'phone')
  ));

create policy "service_manage_xp_ledger" on venue_xp_ledger
  for all using (true) with check (true);

-- ─── KickBack Score (aggregate across all venues) ───────────────
-- Updates point_balances — the existing table already tracks total_earned,
-- balance, tier, etc. We add a kickback_score column that sums all venue XP.

alter table point_balances add column if not exists kickback_score integer not null default 0;

-- ─── Function: Grant Venue XP ────────────────────────────────────
-- Awards XP at a specific venue, updates the user's venue profile,
-- checks milestone progression, and rolls up to KickBack score.

create or replace function grant_venue_xp(
  p_user_id uuid,
  p_venue_id uuid,
  p_action text,
  p_amount integer default null  -- null = use the venue's defined amount for this action
) returns jsonb as $$
declare
  action_record record;
  final_amount integer;
  daily_count integer;
  venue_xp_total integer;
  old_milestone_id uuid;
  new_milestone_id uuid;
  new_milestone_name text;
  all_venue_xp integer;
begin
  -- Look up the venue's XP action definition
  select * into action_record
  from venue_xp_actions
  where venue_id = p_venue_id and action = p_action and active = true
  limit 1;

  -- If venue hasn't defined this action, skip
  if not found and p_amount is null then
    return jsonb_build_object('xp', 0, 'reason', 'action_not_defined');
  end if;

  final_amount := coalesce(p_amount, action_record.points);

  -- Check daily limit
  if action_record.max_per_day is not null then
    select count(*) into daily_count
    from venue_xp_ledger
    where user_id = p_user_id
      and venue_id = p_venue_id
      and reason = p_action
      and created_at >= current_date;

    if daily_count >= action_record.max_per_day then
      return jsonb_build_object('xp', 0, 'reason', 'daily_limit_reached');
    end if;
  end if;

  -- Log the XP event
  insert into venue_xp_ledger (user_id, venue_id, xp_action_id, amount, reason)
  values (p_user_id, p_venue_id, action_record.id, final_amount, p_action);

  -- Upsert user's venue XP profile
  insert into user_venue_xp (user_id, venue_id, xp, visits, last_visit_at)
  values (p_user_id, p_venue_id, final_amount,
    case when p_action in ('visit', 'first_visit') then 1 else 0 end,
    case when p_action in ('visit', 'first_visit') then now() else null end)
  on conflict (user_id, venue_id) do update set
    xp = user_venue_xp.xp + final_amount,
    visits = user_venue_xp.visits + case when p_action in ('visit', 'first_visit') then 1 else 0 end,
    last_visit_at = case when p_action in ('visit', 'first_visit') then now() else user_venue_xp.last_visit_at end,
    updated_at = now();

  -- Get current venue XP total
  select xp into venue_xp_total from user_venue_xp
  where user_id = p_user_id and venue_id = p_venue_id;

  -- Check milestone progression
  select milestone_id into old_milestone_id from user_venue_xp
  where user_id = p_user_id and venue_id = p_venue_id;

  select id, name into new_milestone_id, new_milestone_name
  from venue_xp_milestones
  where venue_id = p_venue_id and threshold <= venue_xp_total
  order by threshold desc
  limit 1;

  -- Update milestone if progressed
  if new_milestone_id is distinct from old_milestone_id then
    update user_venue_xp set milestone_id = new_milestone_id
    where user_id = p_user_id and venue_id = p_venue_id;
  end if;

  -- Roll up to KickBack score: sum all venue XP
  select coalesce(sum(xp), 0) into all_venue_xp
  from user_venue_xp where user_id = p_user_id;

  -- Upsert point_balances with kickback_score
  insert into point_balances (user_id, kickback_score, total_earned, balance)
  values (p_user_id, all_venue_xp, final_amount, final_amount)
  on conflict (user_id) do update set
    kickback_score = all_venue_xp,
    total_earned = point_balances.total_earned + final_amount,
    balance = point_balances.balance + final_amount,
    updated_at = now();

  -- Update tier based on kickback_score
  update point_balances set tier = case
    when all_venue_xp >= 5000 then 'vip'
    when all_venue_xp >= 1500 then 'member'
    when all_venue_xp >= 500 then 'regular'
    else 'explorer'
  end
  where user_id = p_user_id;

  return jsonb_build_object(
    'xp', final_amount,
    'venue_xp_total', venue_xp_total,
    'kickback_score', all_venue_xp,
    'milestone', coalesce(new_milestone_name, null),
    'milestone_changed', new_milestone_id is distinct from old_milestone_id
  );
end;
$$ language plpgsql security definer;
