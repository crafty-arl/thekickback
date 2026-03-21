-- Add staff_id to venue_bookings so we can track which staff member a booking is with
ALTER TABLE venue_bookings ADD COLUMN IF NOT EXISTS staff_id uuid REFERENCES venue_staff(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_venue_bookings_staff ON venue_bookings(staff_id, starts_at);
