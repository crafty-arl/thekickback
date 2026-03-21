import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

/* Day-of-week helper: JS getDay() → short name matching schedule JSONB */
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/* Parse "9:00" or "17:30" → minutes since midnight */
function parseTime(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

/* Format minutes since midnight → "9:00 AM" */
function formatTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
}

/* Build ISO datetime from a date string + minutes offset */
function toISO(dateStr: string, mins: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setMinutes(d.getMinutes() + mins);
  return d.toISOString();
}

/* Try to parse venue hours JSONB into start/end minutes for a given day */
function parseVenueHoursForDay(
  hours: { day: string; open: string; close: string }[],
  dayName: string
): { start: number; end: number } | null {
  if (!hours || hours.length === 0) return null;

  // Try exact day match
  const exact = hours.find((h) => h.day.toLowerCase().startsWith(dayName.toLowerCase()));
  if (exact && exact.open) {
    const openMins = parseTimeFlexible(exact.open);
    const closeMins = exact.close ? parseTimeFlexible(exact.close) : (openMins !== null ? openMins + 480 : null);
    if (openMins !== null && closeMins !== null) return { start: openMins, end: closeMins };
  }

  // Try "Daily" / "See venue" / generic entry
  const generic = hours.find((h) =>
    h.day.toLowerCase().includes("daily") ||
    h.day.toLowerCase().includes("see") ||
    h.day.toLowerCase().includes("all")
  );
  if (generic && generic.open) {
    const openMins = parseTimeFlexible(generic.open);
    const closeMins = generic.close ? parseTimeFlexible(generic.close) : (openMins !== null ? openMins + 480 : null);
    if (openMins !== null && closeMins !== null) return { start: openMins, end: closeMins };
  }

  // Fallback: use first entry
  if (hours[0]?.open) {
    const openMins = parseTimeFlexible(hours[0].open);
    const closeMins = hours[0].close ? parseTimeFlexible(hours[0].close) : (openMins !== null ? openMins + 480 : null);
    if (openMins !== null && closeMins !== null) return { start: openMins, end: closeMins };
  }

  return null;
}

/* Flexible time parser: handles "9am", "5:00 PM", "17:00", "5pm-midnight", etc. */
function parseTimeFlexible(t: string): number | null {
  if (!t) return null;
  // Extract first time from strings like "5pm to midnight" or "9am - 5pm"
  const cleaned = t.split(/\s*[-–—to]\s*/i)[0].trim();

  // "midnight" / "noon"
  if (cleaned.toLowerCase() === "midnight") return 0;
  if (cleaned.toLowerCase() === "noon") return 720;

  // "9am", "5pm", "10:30pm"
  const ampmMatch = cleaned.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
  if (ampmMatch) {
    let h = parseInt(ampmMatch[1]);
    const m = ampmMatch[2] ? parseInt(ampmMatch[2]) : 0;
    const isPM = ampmMatch[3].toLowerCase() === "pm";
    if (isPM && h !== 12) h += 12;
    if (!isPM && h === 12) h = 0;
    return h * 60 + m;
  }

  // "17:00" or "9:00"
  const milMatch = cleaned.match(/^(\d{1,2}):(\d{2})$/);
  if (milMatch) {
    return parseInt(milMatch[1]) * 60 + parseInt(milMatch[2]);
  }

  // Just a number: "9" → 9am, "17" → 5pm
  const numMatch = cleaned.match(/^(\d{1,2})$/);
  if (numMatch) {
    const h = parseInt(numMatch[1]);
    return h * 60;
  }

  return null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const offeringId = url.searchParams.get("offeringId");
  const date = url.searchParams.get("date"); // YYYY-MM-DD
  const staffIdParam = url.searchParams.get("staffId"); // optional

  if (!offeringId || !date) {
    return Response.json(
      { error: "Missing required params: offeringId, date" },
      { status: 400 }
    );
  }

  // 1. Get the offering
  const { data: offering } = await supabase
    .from("venue_offerings")
    .select("id, venue_id, duration_minutes, name, capacity")
    .eq("id", offeringId)
    .single();

  if (!offering) {
    return Response.json({ error: "Offering not found" }, { status: 404 });
  }

  const duration = offering.duration_minutes || 30;
  const venueId = offering.venue_id;

  // 2. Get staff linked to this offering
  const { data: links } = await supabase
    .from("staff_offerings")
    .select("staff_id")
    .eq("offering_id", offeringId);

  const linkedStaffIds = (links || []).map((l: { staff_id: string }) => l.staff_id);

  // 3. Determine day of week
  const requestedDate = new Date(date + "T12:00:00");
  const dayName = DAY_NAMES[requestedDate.getDay()];

  // 4. Get existing bookings for the day
  const dayStart = date + "T00:00:00.000Z";
  const dayEnd = date + "T23:59:59.999Z";

  // ─── Path A: Staff-based availability ─────────────────────────
  if (linkedStaffIds.length > 0) {
    const targetStaffIds = staffIdParam
      ? linkedStaffIds.filter((id: string) => id === staffIdParam)
      : linkedStaffIds;

    if (targetStaffIds.length === 0) {
      return Response.json({ staff: [], anyone_slots: [] });
    }

    const { data: staffMembers } = await supabase
      .from("venue_staff")
      .select("id, display_name, avatar_url, schedule")
      .in("id", targetStaffIds);

    if (!staffMembers || staffMembers.length === 0) {
      return Response.json({ staff: [], anyone_slots: [] });
    }

    // Get all bookings for these staff on this date
    const { data: existingBookings } = await supabase
      .from("venue_bookings")
      .select("id, staff_id, starts_at, ends_at, duration_minutes")
      .in("cal_status", ["confirmed", "accepted", "pending"])
      .in("staff_id", targetStaffIds)
      .gte("starts_at", dayStart)
      .lte("starts_at", dayEnd);

    const { data: offeringBookings } = await supabase
      .from("venue_bookings")
      .select("id, staff_id, starts_at, ends_at, duration_minutes")
      .eq("offering_id", offeringId)
      .in("cal_status", ["confirmed", "accepted", "pending"])
      .is("staff_id", null)
      .gte("starts_at", dayStart)
      .lte("starts_at", dayEnd);

    const allBookings = [...(existingBookings || []), ...(offeringBookings || [])];

    const result: { id: string; name: string; avatar_url: string | null; slots: string[] }[] = [];
    const allSlots = new Set<string>();

    for (const member of staffMembers) {
      const schedule = (member.schedule || []) as { day: string; start: string; end: string }[];
      const daySchedule = schedule.find((s) => s.day.toLowerCase() === dayName.toLowerCase());

      if (!daySchedule) {
        result.push({ id: member.id, name: member.display_name, avatar_url: member.avatar_url, slots: [] });
        continue;
      }

      const startMins = parseTime(daySchedule.start);
      const endMins = parseTime(daySchedule.end);
      const slots = generateSlots(date, startMins, endMins, duration, allBookings, member.id);

      for (const s of slots) allSlots.add(s);
      result.push({ id: member.id, name: member.display_name, avatar_url: member.avatar_url, slots });
    }

    const anyoneSlots = sortSlots(Array.from(allSlots));
    return Response.json({ staff: result, anyone_slots: anyoneSlots });
  }

  // ─── Path B: No staff — use venue hours for slots ─────────────
  // Get venue page hours
  const { data: venuePage } = await supabase
    .from("venue_pages")
    .select("hours")
    .eq("venue_id", venueId)
    .single();

  const venueHours = parseVenueHoursForDay(venuePage?.hours || [], dayName);

  // Default: 9am-9pm if no hours set
  const startMins = venueHours?.start ?? 540;  // 9:00 AM
  const endMins = venueHours?.end ?? 1260;     // 9:00 PM

  // Get existing bookings for this offering on this date
  const { data: existingBookings } = await supabase
    .from("venue_bookings")
    .select("id, staff_id, starts_at, ends_at, duration_minutes")
    .eq("offering_id", offeringId)
    .in("cal_status", ["confirmed", "accepted", "pending"])
    .gte("starts_at", dayStart)
    .lte("starts_at", dayEnd);

  const maxCap = offering.capacity || 1;
  const slots = generateCapacitySlots(date, startMins, endMins, duration, existingBookings || [], maxCap);

  return Response.json({
    staff: [],
    anyone_slots: slots,
  });
}

/* Generate slots checking for per-staff conflicts */
function generateSlots(
  date: string, startMins: number, endMins: number, duration: number,
  bookings: { staff_id: string | null; starts_at: string; ends_at: string | null; duration_minutes: number | null }[],
  staffId: string
): string[] {
  const slots: string[] = [];

  for (let slotStart = startMins; slotStart + duration <= endMins; slotStart += duration) {
    const slotStartISO = toISO(date, slotStart);
    const slotEndISO = toISO(date, slotStart + duration);

    const hasConflict = bookings.some((b) => {
      if (b.staff_id && b.staff_id !== staffId) return false;
      const bStart = new Date(b.starts_at).getTime();
      const bEnd = b.ends_at ? new Date(b.ends_at).getTime() : bStart + (b.duration_minutes || 30) * 60000;
      const sStart = new Date(slotStartISO).getTime();
      const sEnd = new Date(slotEndISO).getTime();
      return bStart < sEnd && bEnd > sStart;
    });

    if (!hasConflict) slots.push(formatTime(slotStart));
  }

  return slots;
}

/* Generate slots checking against offering capacity */
function generateCapacitySlots(
  date: string, startMins: number, endMins: number, duration: number,
  bookings: { starts_at: string; ends_at: string | null; duration_minutes: number | null }[],
  capacity: number
): string[] {
  const slots: string[] = [];

  for (let slotStart = startMins; slotStart + duration <= endMins; slotStart += duration) {
    const slotStartISO = toISO(date, slotStart);
    const slotEndISO = toISO(date, slotStart + duration);

    const overlapping = bookings.filter((b) => {
      const bStart = new Date(b.starts_at).getTime();
      const bEnd = b.ends_at ? new Date(b.ends_at).getTime() : bStart + (b.duration_minutes || 30) * 60000;
      const sStart = new Date(slotStartISO).getTime();
      const sEnd = new Date(slotEndISO).getTime();
      return bStart < sEnd && bEnd > sStart;
    }).length;

    if (overlapping < capacity) slots.push(formatTime(slotStart));
  }

  return slots;
}

/* Sort time labels chronologically */
function sortSlots(slots: string[]): string[] {
  return slots.sort((a, b) => {
    const parse = (s: string) => {
      const [time, ampm] = s.split(" ");
      const [h, m] = time.split(":").map(Number);
      return ((h % 12) + (ampm === "PM" ? 12 : 0)) * 60 + m;
    };
    return parse(a) - parse(b);
  });
}
