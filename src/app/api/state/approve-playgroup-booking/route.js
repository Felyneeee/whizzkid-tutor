import { NextResponse } from "next/server";
import { fmtDate, nowISO, uid, weekday } from "@/lib/dates";
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
    const { bookingId } = await request.json();
    if (typeof bookingId !== "string" || !bookingId) return NextResponse.json({ error: "Choose a Playgroup booking." }, { status: 400 });

    connection = await mysqlPool.getConnection();
    await connection.beginTransaction();
    const { state, initialized } = await readApplicationState(connection, { lock: true });
    if (!initialized) {
      await connection.rollback();
      return NextResponse.json({ error: "Playgroup data is not initialized." }, { status: 409 });
    }
    const booking = state.bookings.find((entry) => entry.id === bookingId && String(entry.program || "").toLowerCase() === "playgroup");
    const status = String(booking?.status || booking?.bookingStatus || "").toLowerCase();
    if (!booking) {
      await connection.rollback();
      return NextResponse.json({ error: "Playgroup booking not found." }, { status: 404 });
    }
    if (["to_pay", "awaiting_payment_approval", "approved", "confirmed"].includes(status)) {
      await connection.rollback();
      return NextResponse.json({ ok: true, status, alreadyApproved: true });
    }
    if (!["pending", "awaiting_admin"].includes(status)) {
      await connection.rollback();
      return NextResponse.json({ error: "This Playgroup booking is no longer waiting for approval.", status }, { status: 409 });
    }

    const nextState = structuredClone(state);
    const target = nextState.bookings.find((entry) => entry.id === bookingId);
    const cohort = nextState.cohorts.find((entry) => entry.id === target.cohortId);
    const assignments = { ...(target.tutorAssignments || {}) };
    if (cohort) {
      (target.dates || []).forEach((date) => {
        const day = weekday(date);
        const tutorId = cohort.dateTutorOverrides?.[date] || cohort.weekdayTutorIds?.[day];
        if (!assignments[date] && tutorId) assignments[date] = tutorId;
      });
    }
    if (!target.dates?.length || !target.dates.every((date) => assignments[date])) {
      await connection.rollback();
      return NextResponse.json({ error: "Assign an available tutor for every Playgroup date before approving this booking." }, { status: 409 });
    }

    const paymentDeadlineAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    target.status = "to_pay";
    target.bookingStatus = "to_pay";
    target.paymentStatus = "to_pay";
    target.paymentDeadlineAt = paymentDeadlineAt;
    target.expiresAt = paymentDeadlineAt;
    target.paymentAmount = target.totalFee;
    target.tutorAssignmentStatus = "Confirmed";
    target.tutorAssignments = assignments;
    const assignedTutorIds = [...new Set(Object.values(assignments))];
    target.tutorId = assignedTutorIds.length === 1 ? assignedTutorIds[0] : undefined;
    if (cohort) {
      cohort.enrolled ||= [];
      if (!cohort.enrolled.includes(target.tuteeId)) cohort.enrolled.push(target.tuteeId);
    }

    const notices = [
      { userId: target.tuteeId, text: "Your Playgroup booking is approved and your tutors are confirmed for all sessions. Please submit payment proof within 48 hours to secure your place.", channels: ["web", "email", "sms"] },
      ...assignedTutorIds.map((tutorId) => {
        const tutorDates = target.dates.filter((date) => assignments[date] === tutorId);
        return { userId: tutorId, text: `Your Playgroup assignment is confirmed for ${tutorDates.length} sessions, starting ${fmtDate(tutorDates[0])}.`, channels: ["web", "email"] };
      }),
    ];
    notices.forEach((notice) => nextState.notifications.unshift({ id: uid("n"), ...notice, at: nowISO(), read: false }));

    await persistRelationalState(connection, nextState, state);
    await connection.execute("UPDATE application_state SET revision = revision + 1 WHERE id = 1");
    await connection.commit();
    return NextResponse.json({ ok: true, status: "to_pay", paymentDeadlineAt });
  } catch (error) {
    if (connection) await connection.rollback().catch(() => undefined);
    console.error("[approve-playgroup-booking]", error?.code ?? "UNKNOWN", error?.message ?? "No error detail");
    return NextResponse.json({ error: "Could not approve the Playgroup booking." }, { status: 503 });
  } finally {
    connection?.release();
  }
}
