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
    const permission = authorizeBusinessAction(state, user, body.action, body.args);
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
      const valid = booking && typeof booking === "object"
        && ["reading", "academic"].includes(booking.program)
        && (booking.program === "reading" ? booking.subject === "Reading" : SUBJECTS.includes(booking.subject))
        && GRADE_LEVELS.includes(booking.gradeLevel)
        && ["online", "face-to-face"].includes(booking.modality)
        && typeof booking.learningNeeds === "string" && booking.learningNeeds.length <= 2000
        && ["one-time", "recurring"].includes(booking.bookingType)
        && (booking.sessionType === undefined || ["one-on-one", "group"].includes(booking.sessionType))
        && (booking.program !== "reading" || !booking.sessionType || booking.sessionType === "one-on-one")
        && Array.isArray(booking.dates) && booking.dates.length > 0 && booking.dates.length <= 60
        && booking.dates.every((date) => validDate(date) && date >= todayISO())
        && new Set(booking.dates).size === booking.dates.length
        && HOURS.includes(booking.time)
        && booking.dates.every((date) => {
          const day = new Date(`${date}T00:00:00Z`).getUTCDay();
          return day === 1 || day === 3 || day === 5
            ? !["10:00", "10:45"].includes(booking.time)
            : day === 2 || day === 4 || day === 6;
        });
      if (!valid) {
        await connection.rollback();
        return NextResponse.json({ error: "Booking details are invalid. Choose a valid program, grade, modality, future date(s), and time (up to 60 sessions)." }, { status: 400 });
      }
      if (booking.program === "reading") {
        const assessment = state.assessments.find((entry) => entry.id === booking.assessmentId && entry.tuteeId === user.id && entry.status === "completed");
        if (!assessment) {
          await connection.rollback();
          return NextResponse.json({ error: "Complete a reading assessment before requesting a reading program." }, { status: 400 });
        }
      }
      const duplicate = state.bookings.some((entry) => entry.tuteeId === user.id && entry.program === booking.program
        && ["awaiting_admin", "confirmed"].includes(entry.status)
        && entry.dates.some((date) => booking.dates.includes(date) && (entry.sessionTimes?.[date] ?? entry.time) === booking.time));
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
          && JSON.stringify(expandBookingDates({ type: "recurring", ...recurrence })) === JSON.stringify(booking.dates);
        if (!recurrenceValid) {
          await connection.rollback();
          return NextResponse.json({ error: "Recurring schedule details are invalid." }, { status: 400 });
        }
      }
    }

    let nextState = structuredClone(state);
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
      return NextResponse.json({ error: result.error, result }, { status: 409 });
    }
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
