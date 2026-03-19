-- ╔═══════════════════════════════════════════════════════════╗
-- ║  Sample beauty venues: barbershop + nail salon           ║
-- ║  Each with staff, offerings, and staff-offering links    ║
-- ╚═══════════════════════════════════════════════════════════╝

-- ─── 1. Venues ───────────────────────────────────────────────

INSERT INTO venues (id, name, type, address, neighborhood, lat, lng, max_occupancy, occupancy, vibe, state, phone, rules)
VALUES
  (
    'b0b0b0b0-fade-4000-a000-ba0be0500001',
    'Tight Lines Barbershop',
    'barbershop',
    '2012 S Congress Ave, Austin, TX 78704',
    'South Congress',
    30.2460, -97.7490,
    12, 4, 'moderate', 'active',
    '+15125550101',
    '["Walk-ins welcome when chairs open", "Cash & card accepted", "No kids under 10 unattended"]'::jsonb
  ),
  (
    'a1a1a1a1-face-4000-b000-0a115a100001',
    'Lacquer Lounge',
    'nail_salon',
    '1608 S Lamar Blvd, Austin, TX 78704',
    'South Lamar',
    30.2550, -97.7660,
    16, 6, 'quiet', 'active',
    '+15125550102',
    '["Appointments preferred", "Walk-ins based on availability", "Please arrive 5 min early"]'::jsonb
  );

-- ─── 2. Venue Pages ─────────────────────────────────────────

INSERT INTO venue_pages (venue_id, slug, tagline, description, theme_color, published, review_status)
VALUES
  (
    'b0b0b0b0-fade-4000-a000-ba0be0500001',
    'tight-lines-barbershop',
    'Sharp cuts. Clean lines. South Congress.',
    'Tight Lines is a modern barbershop on South Congress specializing in fades, lineups, and beard sculpting. Walk-ins welcome, appointments preferred for hot towel shaves.',
    '#F59E0B',
    true,
    'approved'
  ),
  (
    'a1a1a1a1-face-4000-b000-0a115a100001',
    'lacquer-lounge',
    'Nails done right. Chill vibes.',
    'Lacquer Lounge is a boutique nail studio on South Lamar offering gel manicures, pedicures, nail art, and dip powder sets in a calm, plant-filled space.',
    '#EC4899',
    true,
    'approved'
  );

-- ─── 3. Staff ────────────────────────────────────────────────

-- Tight Lines Barbershop staff
INSERT INTO venue_staff (id, venue_id, display_name, role_title, bio, specialties, visible, sort_order, schedule)
VALUES
  (
    'aa000001-ba0b-4000-a001-5aff00000001',
    'b0b0b0b0-fade-4000-a000-ba0be0500001',
    'Marcus Cole',
    'Head Barber',
    'Been cutting in Austin since 2014. Known for crispy fades and razor-sharp lineups.',
    ARRAY['Fades', 'Lineups', 'Hot Towel Shave', 'Beard Sculpting'],
    true, 1,
    '[{"day":"Mon","start":"9:00","end":"18:00"},{"day":"Tue","start":"9:00","end":"18:00"},{"day":"Wed","start":"9:00","end":"18:00"},{"day":"Thu","start":"9:00","end":"19:00"},{"day":"Fri","start":"9:00","end":"19:00"},{"day":"Sat","start":"8:00","end":"16:00"}]'::jsonb
  ),
  (
    'aa000002-ba0b-4000-a002-5aff00000002',
    'b0b0b0b0-fade-4000-a000-ba0be0500001',
    'Dez Morales',
    'Senior Barber',
    'Specializes in textured crops and creative designs. Bilingual — English & Spanish.',
    ARRAY['Textured Crop', 'Designs', 'Taper Fade', 'Kids Cuts'],
    true, 2,
    '[{"day":"Tue","start":"10:00","end":"18:00"},{"day":"Wed","start":"10:00","end":"18:00"},{"day":"Thu","start":"10:00","end":"19:00"},{"day":"Fri","start":"10:00","end":"19:00"},{"day":"Sat","start":"9:00","end":"17:00"}]'::jsonb
  ),
  (
    'aa000003-ba0b-4000-a003-5aff00000003',
    'b0b0b0b0-fade-4000-a000-ba0be0500001',
    'Jay Kim',
    'Barber',
    'New to the shop, big on precision. Korean two-block specialist.',
    ARRAY['Two-Block', 'Scissor Cut', 'Fades', 'Hair Styling'],
    true, 3,
    '[{"day":"Mon","start":"11:00","end":"19:00"},{"day":"Wed","start":"11:00","end":"19:00"},{"day":"Thu","start":"11:00","end":"19:00"},{"day":"Fri","start":"11:00","end":"20:00"},{"day":"Sat","start":"10:00","end":"18:00"}]'::jsonb
  );

-- Lacquer Lounge staff
INSERT INTO venue_staff (id, venue_id, display_name, role_title, bio, specialties, visible, sort_order, schedule)
VALUES
  (
    'bb000004-0a11-4000-b001-5aff00000004',
    'a1a1a1a1-face-4000-b000-0a115a100001',
    'Priya Nair',
    'Lead Nail Artist',
    'Hand-painted nail art specialist. 8 years experience. IG: @priya.nails.atx',
    ARRAY['Nail Art', 'Gel Extensions', 'Chrome Nails', 'French Tips'],
    true, 1,
    '[{"day":"Mon","start":"10:00","end":"18:00"},{"day":"Tue","start":"10:00","end":"18:00"},{"day":"Wed","start":"10:00","end":"18:00"},{"day":"Thu","start":"10:00","end":"19:00"},{"day":"Fri","start":"10:00","end":"19:00"},{"day":"Sat","start":"9:00","end":"17:00"}]'::jsonb
  ),
  (
    'bb000005-0a11-4000-b002-5aff00000005',
    'a1a1a1a1-face-4000-b000-0a115a100001',
    'Tanya Brooks',
    'Senior Nail Tech',
    'Pedicure queen. Specializes in spa treatments and dip powder.',
    ARRAY['Pedicures', 'Dip Powder', 'Spa Treatments', 'Acrylic'],
    true, 2,
    '[{"day":"Tue","start":"10:00","end":"18:00"},{"day":"Wed","start":"10:00","end":"18:00"},{"day":"Thu","start":"10:00","end":"19:00"},{"day":"Fri","start":"10:00","end":"19:00"},{"day":"Sat","start":"9:00","end":"17:00"},{"day":"Sun","start":"11:00","end":"16:00"}]'::jsonb
  ),
  (
    'bb000006-0a11-4000-b003-5aff00000006',
    'a1a1a1a1-face-4000-b000-0a115a100001',
    'Mei Chen',
    'Nail Technician',
    'Quick, clean, and always on trend. Express mani specialist.',
    ARRAY['Express Mani', 'Gel Polish', 'Nail Repair', 'Cuticle Care'],
    true, 3,
    '[{"day":"Mon","start":"10:00","end":"17:00"},{"day":"Tue","start":"10:00","end":"17:00"},{"day":"Thu","start":"10:00","end":"18:00"},{"day":"Fri","start":"10:00","end":"18:00"},{"day":"Sat","start":"10:00","end":"16:00"}]'::jsonb
  );

-- ─── 4. Offerings ────────────────────────────────────────────

-- Tight Lines Barbershop offerings
INSERT INTO venue_offerings (id, venue_id, type, name, description, price_cents, duration_minutes, category, active, sort_order)
VALUES
  ('cc000001-ba0b-4000-c001-0ffe00000001', 'b0b0b0b0-fade-4000-a000-ba0be0500001', 'service', 'Classic Fade',         'Skin fade or mid fade with hot towel finish.',   3500, 30, 'haircut',    true, 1),
  ('cc000002-ba0b-4000-c002-0ffe00000002', 'b0b0b0b0-fade-4000-a000-ba0be0500001', 'service', 'Lineup & Edge Up',     'Precision lineup and edge work only.',            2000, 15, 'haircut',    true, 2),
  ('cc000003-ba0b-4000-c003-0ffe00000003', 'b0b0b0b0-fade-4000-a000-ba0be0500001', 'service', 'Scissor Cut',          'Full scissor cut with wash and style.',           4000, 40, 'haircut',    true, 3),
  ('cc000004-ba0b-4000-c004-0ffe00000004', 'b0b0b0b0-fade-4000-a000-ba0be0500001', 'service', 'Hot Towel Shave',      'Straight razor shave with hot towel and balm.',   3000, 25, 'grooming',   true, 4),
  ('cc000005-ba0b-4000-c005-0ffe00000005', 'b0b0b0b0-fade-4000-a000-ba0be0500001', 'service', 'Beard Sculpting',      'Shape, trim, and line your beard.',               2500, 20, 'grooming',   true, 5),
  ('cc000006-ba0b-4000-c006-0ffe00000006', 'b0b0b0b0-fade-4000-a000-ba0be0500001', 'service', 'Fade + Beard Combo',   'Classic fade plus full beard sculpt.',             5500, 45, 'haircut',    true, 6),
  ('cc000007-ba0b-4000-c007-0ffe00000007', 'b0b0b0b0-fade-4000-a000-ba0be0500001', 'service', 'Kids Cut (Under 12)',  'Clipper or scissor cut for the little ones.',      2500, 25, 'haircut',    true, 7),
  ('cc000008-ba0b-4000-c008-0ffe00000008', 'b0b0b0b0-fade-4000-a000-ba0be0500001', 'service', 'Design Add-On',       'Custom hair design carved into your fade.',        1500, 15, 'design',     true, 8);

-- Lacquer Lounge offerings
INSERT INTO venue_offerings (id, venue_id, type, name, description, price_cents, duration_minutes, category, active, sort_order)
VALUES
  ('dd000001-0a11-4000-d001-0ffe00000001', 'a1a1a1a1-face-4000-b000-0a115a100001', 'service', 'Classic Manicure',       'Shape, buff, cuticle care, and polish.',             3000, 30, 'manicure',   true, 1),
  ('dd000002-0a11-4000-d002-0ffe00000002', 'a1a1a1a1-face-4000-b000-0a115a100001', 'service', 'Gel Manicure',           'Long-lasting gel polish with UV cure.',              4500, 40, 'manicure',   true, 2),
  ('dd000003-0a11-4000-d003-0ffe00000003', 'a1a1a1a1-face-4000-b000-0a115a100001', 'service', 'Dip Powder Set',         'Full dip powder application. Lasts 3-4 weeks.',     5500, 50, 'manicure',   true, 3),
  ('dd000004-0a11-4000-d004-0ffe00000004', 'a1a1a1a1-face-4000-b000-0a115a100001', 'service', 'Gel Extensions',         'Soft gel tip extensions with gel polish.',           7500, 75, 'manicure',   true, 4),
  ('dd000005-0a11-4000-d005-0ffe00000005', 'a1a1a1a1-face-4000-b000-0a115a100001', 'service', 'Nail Art (Per Nail)',    'Hand-painted custom design per nail.',                500,  5, 'nail_art',   true, 5),
  ('dd000006-0a11-4000-d006-0ffe00000006', 'a1a1a1a1-face-4000-b000-0a115a100001', 'service', 'Classic Pedicure',       'Soak, scrub, shape, and polish.',                   4500, 45, 'pedicure',   true, 6),
  ('dd000007-0a11-4000-d007-0ffe00000007', 'a1a1a1a1-face-4000-b000-0a115a100001', 'service', 'Spa Pedicure',           'Extended pedicure with hot stone massage and mask.', 6500, 60, 'pedicure',   true, 7),
  ('dd000008-0a11-4000-d008-0ffe00000008', 'a1a1a1a1-face-4000-b000-0a115a100001', 'service', 'Express Mani',           'Quick shape and gel polish. In and out.',            2500, 20, 'manicure',   true, 8),
  ('dd000009-0a11-4000-d009-0ffe00000009', 'a1a1a1a1-face-4000-b000-0a115a100001', 'service', 'Mani + Pedi Combo',     'Classic manicure and classic pedicure bundle.',      6500, 70, 'combo',      true, 9);

-- ─── 5. Staff-Offering Links ─────────────────────────────────

-- Marcus: fades, lineup, shave, beard, combo
INSERT INTO staff_offerings (staff_id, offering_id) VALUES
  ('aa000001-ba0b-4000-a001-5aff00000001', 'cc000001-ba0b-4000-c001-0ffe00000001'),
  ('aa000001-ba0b-4000-a001-5aff00000001', 'cc000002-ba0b-4000-c002-0ffe00000002'),
  ('aa000001-ba0b-4000-a001-5aff00000001', 'cc000004-ba0b-4000-c004-0ffe00000004'),
  ('aa000001-ba0b-4000-a001-5aff00000001', 'cc000005-ba0b-4000-c005-0ffe00000005'),
  ('aa000001-ba0b-4000-a001-5aff00000001', 'cc000006-ba0b-4000-c006-0ffe00000006');

-- Dez: fades, designs, kids cuts
INSERT INTO staff_offerings (staff_id, offering_id) VALUES
  ('aa000002-ba0b-4000-a002-5aff00000002', 'cc000001-ba0b-4000-c001-0ffe00000001'),
  ('aa000002-ba0b-4000-a002-5aff00000002', 'cc000007-ba0b-4000-c007-0ffe00000007'),
  ('aa000002-ba0b-4000-a002-5aff00000002', 'cc000008-ba0b-4000-c008-0ffe00000008'),
  ('aa000002-ba0b-4000-a002-5aff00000002', 'cc000002-ba0b-4000-c002-0ffe00000002');

-- Jay: scissor cut, fades, lineup
INSERT INTO staff_offerings (staff_id, offering_id) VALUES
  ('aa000003-ba0b-4000-a003-5aff00000003', 'cc000003-ba0b-4000-c003-0ffe00000003'),
  ('aa000003-ba0b-4000-a003-5aff00000003', 'cc000001-ba0b-4000-c001-0ffe00000001'),
  ('aa000003-ba0b-4000-a003-5aff00000003', 'cc000002-ba0b-4000-c002-0ffe00000002');

-- Priya: gel, extensions, nail art, dip
INSERT INTO staff_offerings (staff_id, offering_id) VALUES
  ('bb000004-0a11-4000-b001-5aff00000004', 'dd000002-0a11-4000-d002-0ffe00000002'),
  ('bb000004-0a11-4000-b001-5aff00000004', 'dd000004-0a11-4000-d004-0ffe00000004'),
  ('bb000004-0a11-4000-b001-5aff00000004', 'dd000005-0a11-4000-d005-0ffe00000005'),
  ('bb000004-0a11-4000-b001-5aff00000004', 'dd000003-0a11-4000-d003-0ffe00000003');

-- Tanya: pedicures, dip, spa, combo
INSERT INTO staff_offerings (staff_id, offering_id) VALUES
  ('bb000005-0a11-4000-b002-5aff00000005', 'dd000006-0a11-4000-d006-0ffe00000006'),
  ('bb000005-0a11-4000-b002-5aff00000005', 'dd000007-0a11-4000-d007-0ffe00000007'),
  ('bb000005-0a11-4000-b002-5aff00000005', 'dd000003-0a11-4000-d003-0ffe00000003'),
  ('bb000005-0a11-4000-b002-5aff00000005', 'dd000009-0a11-4000-d009-0ffe00000009');

-- Mei: express, classic mani, gel, combo
INSERT INTO staff_offerings (staff_id, offering_id) VALUES
  ('bb000006-0a11-4000-b003-5aff00000006', 'dd000008-0a11-4000-d008-0ffe00000008'),
  ('bb000006-0a11-4000-b003-5aff00000006', 'dd000001-0a11-4000-d001-0ffe00000001'),
  ('bb000006-0a11-4000-b003-5aff00000006', 'dd000002-0a11-4000-d002-0ffe00000002'),
  ('bb000006-0a11-4000-b003-5aff00000006', 'dd000009-0a11-4000-d009-0ffe00000009');

-- ─── 6. XP Actions ───────────────────────────────────────────

INSERT INTO venue_xp_actions (venue_id, action, label, points, active, sort_order) VALUES
  ('b0b0b0b0-fade-4000-a000-ba0be0500001', 'checkin',  'Check in',       50,  true, 1),
  ('b0b0b0b0-fade-4000-a000-ba0be0500001', 'purchase', 'Get a cut',      100, true, 2),
  ('b0b0b0b0-fade-4000-a000-ba0be0500001', 'referral', 'Refer a friend', 200, true, 3),
  ('a1a1a1a1-face-4000-b000-0a115a100001', 'checkin',  'Check in',       50,  true, 1),
  ('a1a1a1a1-face-4000-b000-0a115a100001', 'purchase', 'Book a service', 100, true, 2),
  ('a1a1a1a1-face-4000-b000-0a115a100001', 'referral', 'Refer a friend', 200, true, 3);

-- ─── 7. XP Milestones ───────────────────────────────────────

INSERT INTO venue_xp_milestones (venue_id, name, threshold, color, reward) VALUES
  ('b0b0b0b0-fade-4000-a000-ba0be0500001', 'First Cut',    50,  '#94a3b8', 'Welcome to the chair'),
  ('b0b0b0b0-fade-4000-a000-ba0be0500001', 'Regular',      300, '#4ade80', 'Free lineup on 5th visit'),
  ('b0b0b0b0-fade-4000-a000-ba0be0500001', 'VIP',          1000,'#f97316', 'Priority walk-in + free beard trim'),
  ('a1a1a1a1-face-4000-b000-0a115a100001', 'First Visit',  50,  '#94a3b8', 'Welcome to the lounge'),
  ('a1a1a1a1-face-4000-b000-0a115a100001', 'Regular',      300, '#ec4899', 'Free nail art on 5th visit'),
  ('a1a1a1a1-face-4000-b000-0a115a100001', 'VIP',          1000,'#a78bfa', 'Priority booking + free upgrade');

-- ─── 8. Venue Perks ──────────────────────────────────────────

INSERT INTO venue_perks (venue_id, name, description, point_cost, category, active, sort_order) VALUES
  ('b0b0b0b0-fade-4000-a000-ba0be0500001', 'Free Lineup',       'Complimentary lineup or edge up.',           200, 'experience', true, 1),
  ('b0b0b0b0-fade-4000-a000-ba0be0500001', 'Hot Towel Add-On',  'Free hot towel treatment with any cut.',     100, 'experience', true, 2),
  ('b0b0b0b0-fade-4000-a000-ba0be0500001', '$10 Off Any Cut',   'Discount on your next haircut.',             300, 'drink',      true, 3),
  ('a1a1a1a1-face-4000-b000-0a115a100001', 'Free Nail Art',     'One free nail art design on any service.',   150, 'experience', true, 1),
  ('a1a1a1a1-face-4000-b000-0a115a100001', 'Upgrade to Spa',    'Free upgrade from classic to spa pedicure.', 250, 'experience', true, 2),
  ('a1a1a1a1-face-4000-b000-0a115a100001', '$15 Off Extensions','Discount on gel extensions.',                400, 'access',     true, 3);
