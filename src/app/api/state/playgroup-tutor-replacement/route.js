import { NextResponse } from "next/server";
import { cohortSessionDates, onApprovedLeave, tutorBusy, tutorWorksPlaygroupDate } from "@/lib/logic";
import { fmtDate, nowISO, todayISO, uid, weekday } from "@/lib/dates";
import { authenticatedUser } from "@/server/auth";
import { readApplicationState } from "@/server/application-state";
import { mysqlPool } from "@/server/mysql";
import { persistRelationalState } from "@/server/relational-state";

export const runtime = "nodejs";

export async function POST(request) {
  let connection;
  try {
    const user = await authenticatedUser(request);
    if (!user) return NextResponse.json({ error: "Please log in." }, { status: 401 });
    if (user.role !== "admin") return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
    const { cohortId, date, tutorId } = await request.json();
    connection = await mysqlPool.getConnection();
    await connection.beginTransaction();
    const { state, initialized } = await readApplicationState(connection, { lock: true });
    if (!initialized) {
      await connection.rollback();
      return NextResponse.json({ error: "Playgroup data is not initialized." }, { status: 409 });
    }
    const cohort = state.cohorts.find((item) => item.id === cohortId);
    const tutor = state.tutors.find((item) => item.userId === tutorId && item.status === "active");
    const validDate = typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(`${date}T00:00:00Z`)) && new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date;
    const cohortDates = cohort ? cohortSessionDates(cohort) : [];
    if (!cohort || !validDate || !cohortDates.includes(date) || date < todayISO()) {
      await connection.rollback();
      return NextResponse.json({ error: "Choose a future session date in this cohort." }, { status: 400 });
    }
    if (!tutor || ![1, 3, 5].includes(weekday(date))) {
      await connection.rollback();
      return NextResponse.json({ error: "Choose an active tutor for a Monday, Wednesday, or Friday session." }, { status: 400 });
    }
    const weekdayTutorId = cohort.weekdayTutorIds?.[weekday(date)] || "";
    if (tutorId === weekdayTutorId) {
      await connection.rollback();
      return NextResponse.json({ error: "Choose a tutor other than the cohort’s regular tutor for this weekday." }, { status: 400 });
    }
    const bookings = state.bookings.filter((booking) => booking.program === "playgroup" && booking.cohortId === cohortId && ["pending", "approved", "confirmed", "awaiting_admin"].includes(booking.status) && booking.dates.includes(date));
    if (!bookings.length) {
      await connection.rollback();
      return NextResponse.json({ error: "No active enrolled students have a session on this date." }, { status: 409 });
    }
    const conflicts = state.sessions.some((session) => session.tutorId === tutorId && session.date === date && ["scheduled", "needs_reassignment"].includes(session.status) && (() => {
      const start = Number(String(session.time).slice(0, 2)) * 60 + Number(String(session.time).slice(3, 5));
      return start < 690 && start + (Number(session.durationMinutes) || 45) > 600;
    })());
    const otherCohortConflict = state.bookings.some((booking) => booking.cohortId !== cohortId && booking.program === "playgroup" && ["pending", "approved", "confirmed", "awaiting_admin"].includes(booking.status) && booking.dates.includes(date) && (booking.tutorAssignments?.[date] || booking.tutorId) === tutorId);
    if (!tutorWorksPlaygroupDate(state, tutorId, date) || onApprovedLeave(state, tutorId, date) || tutorBusy(state, tutorId, date, cohort.time || "10:00") || conflicts || otherCohortConflict) {
      await connection.rollback();
      return NextResponse.json({ error: "That tutor is not working or available for this Playgroup session." }, { status: 409 });
    }

    const nextState = structuredClone(state);
    const targetCohort = nextState.cohorts.find((item) => item.id === cohortId);
    targetCohort.dateTutorOverrides = { ...(targetCohort.dateTutorOverrides || {}), [date]: tutorId };
    const recipients = new Set([tutorId]);
    nextState.bookings.filter((booking) => booking.program === "playgroup" && booking.cohortId === cohortId && ["pending", "approved", "confirmed", "awaiting_admin"].includes(booking.status) && booking.dates.includes(date)).forEach((booking) => {
      booking.tutorAssignments = { ...(booking.tutorAssignments || {}), [date]: tutorId };
      const assignedIds = [...new Set(Object.values(booking.tutorAssignments))];
      booking.tutorId = assignedIds.length === 1 ? assignedIds[0] : undefined;
      recipients.add(booking.tuteeId);
    });
    const tutorName = nextState.tutors.find((item) => item.userId === tutorId)?.fullName || "Tutor";
    const dayName = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][weekday(date)];
    const message = `Playgroup tutor update for ${targetCohort.label}: ${dayName}, ${fmtDate(date)} will be led by ${tutorName}.`;
    for (const recipientId of recipients) nextState.notifications.unshift({ id: uid("n"), userId: recipientId, text: message, at: nowISO(), read: false, channels: recipientId === tutorId ? ["web", "email"] : ["web", "email", "sms"] });
    await persistRelationalState(connection, nextState, state);
    await connection.execute("UPDATE application_state SET revision = revision + 1 WHERE id = 1");
    await connection.commit();
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (connection) await connection.rollback().catch(() => undefined);
    console.error("[playgroup-tutor-replacement]", error?.code ?? "UNKNOWN", error?.message ?? "No error detail");
    return NextResponse.json({ error: "Could not save the Playgroup tutor replacement." }, { status: 503 });
  } finally {
    connection?.release();
  }
}
