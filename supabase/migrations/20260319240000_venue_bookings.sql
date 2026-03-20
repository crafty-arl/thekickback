-- Local record of every booking made through theKickBack
-- Cal.com is source-of-truth but this gives venue owners dashboard visibility

create table if not exists venue_bookings (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references venues(id) on delete cascade,
  offering_id uuid not null references venue_offerings(id) on delete cascade,
  cal_booking_id int,
  cal_booking_uid text,
  cal_status text not null default 'confirmed',
  offering_name text not null,
  guest_name text not null,
  guest_email text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  duration_minutes int,
  notes text,
  created_at timestamptz not null default now()
);

alter table venue_bookings enable row level security;

create policy "venue_owners_read_bookings" on venue_bookings
  for select using (
    venue_id in (select venue_id from venue_owners where user_id = auth.uid())
  );

create index idx_venue_bookings_venue on venue_bookings (venue_id, starts_at desc);
create index idx_venue_bookings_upcoming on venue_bookings (venue_id, starts_at) where cal_status = 'confirmed';
