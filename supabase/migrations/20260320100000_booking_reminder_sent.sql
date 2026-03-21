-- Add reminder_sent flag to venue_bookings for 24h booking reminder emails
alter table venue_bookings add column if not exists reminder_sent boolean;

-- Index for the cron query: upcoming bookings that haven't been reminded
create index if not exists idx_venue_bookings_reminder
  on venue_bookings (starts_at)
  where reminder_sent is null and cal_status in ('confirmed', 'accepted');

-- Service role needs full access for the renewal-worker
create policy "service_manage_bookings" on venue_bookings
  for all using (true) with check (true);
