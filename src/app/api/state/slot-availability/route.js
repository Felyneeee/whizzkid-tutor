import { NextResponse } from "next/server";
import { GRADE_LEVELS, HOURS, SUBJECTS } from "@/lib/constants";
import { slotRequestable } from "@/lib/logic";
import { addMonths, todayISO } from "@/lib/dates";
import { authenticatedUser } from "@/server/auth";
import { readStateForUser } from "@/server/application-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const validDate = (value) => typeof value === "string"
  && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
  && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const allowedRescheduleSlot = (date, time) => {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 2 || day === 4 || day === 6 || ((day === 1 || day === 3 || day === 5) && !["10:00", "10:45"].includes(time));
};

export async function POST(request) {
  try {
    const user = await authenticatedUser(request);
    if (!user) return NextResponse.json({ error: "Please log in." }, { status: 401 });
    const input = await request.json();
    const { dates, times, subjects, program, gradeLevel, modality, sessionType, bookingId } = input || {};
    if (user.role !== "tutee" || !Array.isArray(dates) || dates.length > 35 || !dates.every(validDate)
      || !Array.isArray(times) || times.length > HOURS.length || !times.every((time) => HOURS.includes(time))
      || !Array.isArray(subjects) || !subjects.length || subjects.length > SUBJECTS.length + 1
      || !["academic", "reading"].includes(program) || !GRADE_LEVELS.includes(gradeLevel)
      || !["online", "face-to-face"].includes(modality)
      || !["one-on-one", "group"].includes(sessionType)
      || (bookingId !== undefined && typeof bookingId !== "string")
      || (program === "reading" && (sessionType !== "one-on-one" || subjects.some((subject) => subject !== "Reading")))
      || (program === "academic" && !subjects.every((subject) => SUBJECTS.includes(subject)))) {
      return NextResponse.json({ error: "Invalid availability request." }, { status: 400 });
    }
    if (dates.some((date) => date < todayISO() || date > addMonths(todayISO(), 1))) {
      return NextResponse.json({ error: "Sessions can only be booked within the next month." }, { status: 400 });
    }

    const { state } = await readStateForUser(user);
    if (bookingId && !state.bookings.some((booking) => booking.id === bookingId && booking.tuteeId === user.id)) {
      return NextResponse.json({ error: "Invalid booking." }, { status: 403 });
    }
    const available = {};
    for (const date of dates) {
      for (const time of times) {
        for (const subject of subjects) {
          const key = `${date}|${time}|${subject}`;
          const heldForReschedule = state.bookings.some((booking) => {
            const proposal = booking.rescheduleProposal || booking.scheduleProposal?.__payment?.rescheduleProposal;
            return booking.id !== bookingId && (proposal?.date === date && proposal?.time === time || proposal?.sessions?.some((item) => item.date === date && item.time === time));
          });
          available[key] = allowedRescheduleSlot(date, time) && !heldForReschedule && slotRequestable(state, date, time, {
            program, subject, gradeLevel, modality, sessionType,
          }, bookingId);
        }
      }
    }
    return NextResponse.json({ available }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[state/slot-availability]", error?.code ?? "UNKNOWN", error?.message ?? "No error detail");
    return NextResponse.json({ error: "Could not refresh slot availability." }, { status: 503 });
  }
}
