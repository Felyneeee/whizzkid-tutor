import { NextRequest, NextResponse } from "next/server";
import { authorizeBusinessAction } from "@/server/action-access";
import { readApplicationState, stateVisibleToUser } from "@/server/application-state";
import { authenticatedUser } from "@/server/auth";
import { createBusinessActions } from "@/server/business-actions";
import { mysqlPool } from "@/server/mysql";
import { persistRelationalState } from "@/server/relational-state";
import { isValidPdfDataUrl } from "@/lib/resumes";
import { GRADE_LEVELS, HOURS, SUBJECTS } from "@/lib/constants";
import { nowISO, todayISO, uid } from "@/lib/dates";
import { expandBookingDates } from "@/lib/logic";
import { queueCompletedReadingBookings } from "../reading-bookings";

export const runtime = "nodejs";

export async function POST(request) {
  let connection;
  try {
    const user = await authenticatedUser(request);
    if (!user) return NextResponse.json({ error: "Please log in." }, { status: 401 });

    const body = await request.json();
    if (typeof body.action !== "string" || !Array.isArray(body.args) || body.args.length > 12) {
      return NextResponse.json({ error: "Invalid action request." }, { status: 400 });
    }

    connection = await mysqlPool.getConnection();
    await connection.beginTransaction();
    let { state, initialized } = await readApplicationState(connection, { lock: true });
    if (!initialized && user.role !== "admin") {
      await connection.rollback();
      return NextResponse.json({ error: "An administrator must sign in once to initialize shared app data." }, { status: 409 });
    }
    if (!initialized) {
      ({ state, initialized } = await readApplicationState(connection, { lock: true, create: true }));
    }
    const authorizationState = structuredClone(state);
    queueCompletedReadingBookings(authorizationState);
    const permission = authorizeBusinessAction(authorizationState, user, body.action, body.args);
    if (!permission.ok) {
      await connection.rollback();
      return NextResponse.json({ error: permission.error }, { status: 403 });
    }
    if (body.action === "saveTutorProfile") {
      const resumeData = permission.args[1]?.resumeData;
      if (resumeData && !isValidPdfDataUrl(resumeData)) {
        await connection.rollback();
        return NextResponse.json({ error: "Upload a valid PDF resume no larger than 1.5 MB." }, { status: 400 });
      }
    }
    if (body.action === "submitTutorialBooking") {
      const [booking] = permission.args;
      const validDate = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
      const academicLimitValid = () => {
        if (booking.program === "reading") {
          const slots = booking.sessionSlots;
          return Array.isArray(slots) && slots.length === booking.dates.length && slots.every((slot) => slot && booking.dates.includes(slot.date) && validDate(slot.date) && slot.subject === "Reading" && HOURS.includes(slot.time) && slot.time === booking.sessionTimes?.[slot.date] && slot.day === new Date(`${slot.date}T00:00:00Z`).getUTCDay() && slot.day !== 0 && !([1, 3, 5].includes(slot.day) && ["10:00", "10:45"].includes(slot.time)));
        }
        if (booking.program !== "academic") return true;
        const recurrence = booking.recurrence;
        const slots = booking.sessionSlots;
        if (!Array.isArray(slots) || !slots.length) return false;
        if (booking.bookingType !== "recurring" || !recurrence || ![2, 3, 4].includes(recurrence.cycleWeeks) || !Array.isArray(recurrence.days) || recurrence.days.length < 1 || recurrence.days.length > 6) return false;
        const templates = new Map();
        const perDate = new Map();
        for (const slot of slots) {
          if (!slot || typeof slot.seriesKey !== "string" || !booking.dates.includes(slot.date) || !validDate(slot.date) || !HOURS.includes(slot.time) || !booking.subjects.includes(slot.subject) || slot.day !== new Date(`${slot.date}T00:00:00Z`).getUTCDay() || slot.day === 0 || ([1, 3, 5].includes(slot.day) && ["10:00", "10:45"].includes(slot.time))) return false;
          const current = templates.get(slot.seriesKey);
          if (current && (current.day !== slot.day || current.time !== slot.time || current.subject !== slot.subject)) return false;
          if (!current) templates.set(slot.seriesKey, slot);
          perDate.set(slot.date, (perDate.get(slot.date) || 0) + 1);
        }
        const perDay = new Map();
        const perDaySubject = new Map();
        for (const template of templates.values()) {
          perDay.set(template.day, (perDay.get(template.day) || 0) + 1);
          const key = `${template.day}|${template.subject}`;
          perDaySubject.set(key, (perDaySubject.get(key) || 0) + 1);
        }
        const weeks = recurrence.cycleWeeks;
        return booking.dates.length > 0 && booking.dates.length <= 18 * weeks && templates.size <= 18
          && [...perDate.values()].every((count) => count <= 3)
          && [...perDay.values()].every((count) => count <= 3)
          && [...perDaySubject.values()].every((count) => count <= 2)
          && slots.length === templates.size * weeks
          && new Set(slots.map((slot) => slot.date)).size === booking.dates.length
          && booking.dates.length === recurrence.days.length * weeks
          && Array.isArray(booking.subjects) && booking.subjects.length >= 1 && booking.subjects.length <= 5
          && slots.every((slot) => booking.subjects.includes(slot.subject));
      };
      const valid = booking && typeof booking === "object"
        && ["reading", "academic"].includes(booking.program)
        && (booking.program === "reading" ? booking.subject === "Reading" : SUBJECTS.includes(booking.subject))
        && (booking.program !== "academic" || (Array.isArray(booking.subjects) && booking.subjects.length > 0 && booking.subjects.length <= 5 && booking.subjects.every((subject) => SUBJECTS.includes(subject)) && new Set(booking.subjects).size === booking.subjects.length))
        && GRADE_LEVELS.includes(booking.gradeLevel)
        && ["online", "face-to-face"].includes(booking.modality)
        && typeof booking.learningNeeds === "string" && booking.learningNeeds.length <= 2000
        && (booking.program === "academic" ? booking.bookingType === "recurring" : ["one-time", "recurring"].includes(booking.bookingType))
        && (booking.sessionType === undefined || ["one-on-one", "group"].includes(booking.sessionType))
        && (booking.program !== "reading" || !booking.sessionType || booking.sessionType === "one-on-one")
        && Array.isArray(booking.dates) && booking.dates.length > 0 && booking.dates.length <= 60
        && booking.dates.every((date) => validDate(date) && date >= todayISO())
        && new Set(booking.dates).size === booking.dates.length
        && (booking.program === "academic" ? booking.dates.every((date) => HOURS.includes(booking.sessionTimes?.[date]) && booking.subjects.includes(booking.sessionSubjects?.[date])) : HOURS.includes(booking.time))
        && academicLimitValid()
        && booking.dates.every((date) => {
          const day = new Date(`${date}T00:00:00Z`).getUTCDay();
          const time = booking.sessionTimes?.[date] ?? booking.time;
          return day === 1 || day === 3 || day === 5
            ? !["10:00", "10:45"].includes(time)
            : day === 2 || day === 4 || day === 6;
        });
      if (!valid) {
        await connection.rollback();
        return NextResponse.json({ error: "Booking details are invalid. Choose a valid program, grade, modality, future date(s), and time (up to 60 sessions)." }, { status: 400 });
      }
      if (booking.program === "reading") {
        const assessment = booking.assessmentId && state.assessments.find((entry) => entry.id === booking.assessmentId && entry.tuteeId === user.id && ["pending_admin_scheduling", "booked", "completed"].includes(entry.status));
        if (booking.assessmentId && !assessment) {
          await connection.rollback();
          return NextResponse.json({ error: "This initial assessment request is no longer available. Refresh and try again." }, { status: 400 });
        }
      }
      const requestedSlots = booking.sessionSlots || booking.dates.map((date) => ({ date, time: booking.sessionTimes?.[date] ?? booking.time }));
      const duplicate = state.bookings.some((entry) => {
        if (entry.tuteeId !== user.id || entry.program !== booking.program || !["pending_assessment", "assessment_scheduled", "ready_for_matching", "awaiting_admin", "confirmed"].includes(entry.status)) return false;
        const existingSlots = entry.sessionSlots || entry.dates.map((date) => ({ date, time: entry.sessionTimes?.[date] ?? entry.time }));
        return existingSlots.some((existing) => requestedSlots.some((requested) => existing.date === requested.date && existing.time === requested.time));
      });
      if (duplicate) {
        await connection.rollback();
        return NextResponse.json({ error: "You already have a request or booking for this program, date, and time." }, { status: 409 });
      }
      if (booking.recurrence) {
        const recurrence = booking.recurrence;
        const recurrenceValid = booking.bookingType === "recurring" && typeof recurrence === "object"
          && Array.isArray(recurrence.days) && recurrence.days.length > 0
          && recurrence.days.every((day) => Number.isInteger(day) && day >= 0 && day <= 6)
          && new Set(recurrence.days).size === recurrence.days.length
          && validDate(recurrence.start) && validDate(recurrence.end)
          && JSON.stringify(expandBookingDates({ type: "recurring", start: recurrence.start, end: recurrence.end, days: recurrence.days })) === JSON.stringify(booking.dates)
          && (booking.program !== "academic" || ([2, 3, 4].includes(recurrence.cycleWeeks) && recurrence.days.length >= 1 && recurrence.days.length <= 6 && booking.dates.length <= 18 * recurrence.cycleWeeks));
        if (!recurrenceValid) {
          await connection.rollback();
          return NextResponse.json({ error: "Weekly schedule details are invalid." }, { status: 400 });
        }
      }
    }
    if (body.action === "requestAssessment") {
      const modality = permission.args[1];
      if (!(["online", "face-to-face"].includes(modality))) {
        await connection.rollback();
        return NextResponse.json({ error: "Choose a valid assessment modality." }, { status: 400 });
      }
    }
    if (body.action === "scheduleAssessment") {
      const [assessmentId, date, time] = permission.args;
      const validDate = typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(`${date}T00:00:00Z`)) && new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date && date >= todayISO();
      const assessment = state.assessments.find((entry) => entry.id === assessmentId && entry.status === "pending_admin_scheduling");
      const slotTaken = state.assessments.some((entry) => entry.id !== assessmentId && entry.status === "booked" && entry.date === date && entry.time === time);
      if (!assessment || !validDate || !/^09:(00|15|30|45)$/.test(String(time)) || slotTaken) {
        await connection.rollback();
        return NextResponse.json({ error: "Choose a valid date and a time between 9:00 AM and 10:00 AM." }, { status: 400 });
      }
    }

    let nextState = structuredClone(state);
    queueCompletedReadingBookings(nextState);
    const now = Date.now();
    const warningHours = Math.max(1, Number(process.env.BOOKING_EXPIRY_WARNING_HOURS) || 12);
    for (const booking of nextState.bookings) {
      if (booking.status !== "awaiting_admin" || !booking.expiresAt) continue;
      const expiresAt = Date.parse(booking.expiresAt);
      if (expiresAt <= now) {
        booking.status = "expired";
        const text = `Pending ${booking.subject} request from ${booking.tuteeId} expired and released its reserved capacity.`;
        for (const admin of nextState.users.filter((entry) => entry.role === "admin")) nextState.notifications.unshift({ id: uid("n"), userId: admin.id, text, at: nowISO(), read: false, channels: ["web"] });
      } else if (!booking.expirationWarningAt && expiresAt - now <= warningHours * 3600000) {
        booking.expirationWarningAt = nowISO();
        for (const admin of nextState.users.filter((entry) => entry.role === "admin")) nextState.notifications.unshift({ id: uid("n"), userId: admin.id, text: `Pending ${booking.subject} request from ${booking.tuteeId} approaches expiration.`, at: nowISO(), read: false, channels: ["web"] });
      }
    }
    const actions = createBusinessActions({
      get: () => nextState,
      mutate: (update) => {
      const draft = structuredClone(nextState);
        const result = update(draft);
        nextState = draft;
        return result;
      },
    });
    const handler = actions[body.action];
    if (typeof handler !== "function") {
      await connection.rollback();
      return NextResponse.json({ error: "Unknown app action." }, { status: 404 });
    }

    const result = await handler(...permission.args);
    if (result && result.ok === false) {
      await connection.rollback();
      return NextResponse.json({ error: result.error, result, db: stateVisibleToUser(nextState, user) }, { status: 409 });
    }
    queueCompletedReadingBookings(nextState);
    await persistRelationalState(connection, nextState, state);
    await connection.execute(
      "UPDATE application_state SET revision = revision + 1 WHERE id = 1",
    );
    await connection.commit();
    return NextResponse.json({ result: result ?? { ok: true }, db: stateVisibleToUser(nextState, user) });
  } catch (error) {
    if (connection) await connection.rollback().catch(() => undefined);
    console.error("[state/action]", error?.code ?? "UNKNOWN", error?.message ?? "No error detail");
    return NextResponse.json({ error: "Could not save the action to MySQL." }, { status: 503 });
  } finally {
    connection?.release();
  }
}
