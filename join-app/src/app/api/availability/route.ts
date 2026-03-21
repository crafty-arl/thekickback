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

  if (linkedStaffIds.length === 0) {
    return Response.json({ staff: [], anyone_slots: [] });
  }

  // Filter to a single staff member if requested
  const targetStaffIds = staffIdParam
    ? linkedStaffIds.filter((id: string) => id === staffIdParam)
    : linkedStaffIds;

  if (targetStaffIds.length === 0) {
    return Response.json({ staff: [], anyone_slots: [] });
  }

  // 3. Get staff details
  const { data: staffMembers } = await supabase
    .from("venue_staff")
    .select("id, display_name, avatar_url, schedule")
    .in("id", targetStaffIds);

  if (!staffMembers || staffMembers.length === 0) {
    return Response.json({ staff: [], anyone_slots: [] });
  }

  // 4. Determine day of week for requested date
  const requestedDate = new Date(date + "T12:00:00"); // noon to avoid timezone edge
  const dayName = DAY_NAMES[requestedDate.getDay()];

  // 5. Get ALL existing bookings for ALL these staff members on this date
  const dayStart = date + "T00:00:00.000Z";
  const dayEnd = date + "T23:59:59.999Z";

  const { data: existingBookings } = await supabase
    .from("venue_bookings")
    .select("id, staff_id, starts_at, ends_at, duration_minutes")
    .in("cal_status", ["confirmed", "accepted", "pending"])
    .in("staff_id", targetStaffIds)
    .gte("starts_at", dayStart)
    .lte("starts_at", dayEnd);

  // Also get bookings without staff_id (offering-level) for this offering
  const { data: offeringBookings } = await supabase
    .from("venue_bookings")
    .select("id, staff_id, starts_at, ends_at, duration_minutes")
    .eq("offering_id", offeringId)
    .in("cal_status", ["confirmed", "accepted", "pending"])
    .is("staff_id", null)
    .gte("starts_at", dayStart)
    .lte("starts_at", dayEnd);

  const allBookings = [...(existingBookings || []), ...(offeringBookings || [])];

  // 6. For each staff member, generate available slots
  const result: {
    id: string;
    name: string;
    avatar_url: string | null;
    slots: string[];
  }[] = [];

  const allSlots = new Set<string>();

  for (const member of staffMembers) {
    const schedule = (member.schedule || []) as {
      day: string;
      start: string;
      end: string;
    }[];

    // Find schedule entry for this day
    const daySchedule = schedule.find(
      (s) => s.day.toLowerCase() === dayName.toLowerCase()
    );

    if (!daySchedule) {
      result.push({
        id: member.id,
        name: member.display_name,
        avatar_url: member.avatar_url,
        slots: [],
      });
      continue;
    }

    const startMins = parseTime(daySchedule.start);
    const endMins = parseTime(daySchedule.end);

    // Generate slots every {duration} minutes
    const slots: string[] = [];

    for (let slotStart = startMins; slotStart + duration <= endMins; slotStart += duration) {
      const slotStartISO = toISO(date, slotStart);
      const slotEndISO = toISO(date, slotStart + duration);

      // Check for conflicts with this staff member's bookings
      const hasConflict = allBookings.some((b) => {
        // Only check bookings for this staff member (or unassigned for this offering)
        if (b.staff_id && b.staff_id !== member.id) return false;

        const bStart = new Date(b.starts_at).getTime();
        const bEnd = b.ends_at
          ? new Date(b.ends_at).getTime()
          : bStart + (b.duration_minutes || 30) * 60000;
        const sStart = new Date(slotStartISO).getTime();
        const sEnd = new Date(slotEndISO).getTime();

        return bStart < sEnd && bEnd > sStart;
      });

      if (!hasConflict) {
        const label = formatTime(slotStart);
        slots.push(label);
        allSlots.add(label);
      }
    }

    result.push({
      id: member.id,
      name: member.display_name,
      avatar_url: member.avatar_url,
      slots,
    });
  }

  // Sort the merged "anyone" slots chronologically
  const anyoneSlots = Array.from(allSlots).sort((a, b) => {
    const parse = (s: string) => {
      const [time, ampm] = s.split(" ");
      const [h, m] = time.split(":").map(Number);
      return ((h % 12) + (ampm === "PM" ? 12 : 0)) * 60 + m;
    };
    return parse(a) - parse(b);
  });

  return Response.json({
    staff: result,
    anyone_slots: anyoneSlots,
  });
}
