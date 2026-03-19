-- Per-venue AI knowledge base
create table if not exists venue_knowledge (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references venues(id) on delete cascade,
  content text not null,
  category text not null default 'general',
  embedding jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_venue_knowledge_venue on venue_knowledge(venue_id);
create index idx_venue_knowledge_category on venue_knowledge(venue_id, category);

-- RLS
alter table venue_knowledge enable row level security;

-- Venue owners can manage their own knowledge
create policy "venue_owners_manage_knowledge" on venue_knowledge
  for all using (
    venue_id in (
      select venue_id from venue_owners where user_id = auth.uid()
    )
  );

-- Service key can read all (for agent context)
create policy "service_read_knowledge" on venue_knowledge
  for select using (true);
