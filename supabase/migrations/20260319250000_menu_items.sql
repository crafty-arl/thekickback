-- Menu items with inventory tracking
-- Replaces the JSON-based menu_sections on venue_pages with a proper table

create table if not exists venue_menu_items (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references venues(id) on delete cascade,
  category text not null default 'General',
  name text not null,
  description text,
  price_cents int not null default 0,
  in_stock boolean not null default true,
  inventory_count int, -- null = unlimited, number = tracked
  image_url text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table venue_menu_items enable row level security;

create policy "public_read_menu" on venue_menu_items
  for select using (true);

create policy "venue_owners_manage_menu" on venue_menu_items
  for all using (
    venue_id in (select venue_id from venue_owners where user_id = auth.uid())
  );

create index idx_menu_items_venue on venue_menu_items (venue_id, sort_order);
