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
import { expandBookingDates, matchTutors, slotRequestable } from "@/lib/logic";
import { queueCompletedReadingBookings } from "../reading-bookings";

export const runtime = "nodejs";

function unpackExtendedState(state) {
  for (const booking of state.bookings || []) {
    const stored = booking.scheduleProposal;
    if (stored?.__payment) {
      Object.assign(booking, stored.__payment);
      booking.scheduleProposal = stored.proposal;
    }
    if (!booking.status && booking.paymentStatus === "to_pay") booking.status = "to_pay";
    if (!booking.status && booking.paymentStatus === "awaiting_approval") booking.status = "awaiting_payment_approval";
    if (!booking.status && booking.paymentStatus === "proof_rejected") booking.status = "to_pay";
    if (booking.expiresAt && booking.paymentStatus && !booking.paymentDeadlineAt) booking.paymentDeadlineAt = booking.expiresAt;
  }
  return state;
}

function packExtendedState(state) {
  const packed = structuredClone(state);
  for (const booking of packed.bookings || []) {
    const payment = Object.fromEntries(["paymentStatus", "paymentProof", "paymentAmount", "paymentInstructions", "paymentApprovedAt", "paymentReviewedAt", "paymentReviewNote", "paymentProofHistory", "rescheduleProposal", "scheduleHistory"].filter((key) => booking[key] !== undefined).map((key) => [key, booking[key]]));
    if (Object.keys(payment).length) booking.scheduleProposal = { ...(booking.scheduleProposal ? { proposal: booking.scheduleProposal } : {}), __payment: payment };
    else if (booking.scheduleProposal?.__payment) booking.scheduleProposal = booking.scheduleProposal.proposal;
  }
  return packed;
}

function bookingSlotsFullyAssigned(booking, sessions) {
  const requestedSlots = booking.sessionSlots ?? (booking.dates || []).map((date) => ({ date, time: booking.sessionTimes?.[date] ?? booking.time }));
  return requestedSlots.length > 0 && requestedSlots.every((slot) => sessions.some((session) => session.date === slot.date && session.time === slot.time && session.tutorId && session.status !== "cancelled"));
}

function logActivity(state, userId, text) {
  state.activities ??= [];
  state.activities.unshift({ id: uid("a"), userId, kind: "other", text, at: nowISO() });
}

function personName(state, id) {
  const profile = state.tutors.find((entry) => entry.userId === id) || state.tutees.find((entry) => entry.userId === id);
  const account = state.users.find((entry) => entry.id === id);
  return profile?.fullName || (account?.role === "admin" ? "System Admin" : account?.username) || "User";
}

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
    state = unpackExtendedState(state);
    if (!initialized && user.role !== "admin") {
      await connection.rollback();
      return NextResponse.json({ error: "An administrator must sign in once to initialize shared app data." }, { status: 409 });
    }
    if (!initialized) {
    ({ state, initialized } = await readApplicationState(connection, { lock: true, create: true }));
      state = unpackExtendedState(state);
    }
    const authorizationState = structuredClone(state);
    queueCompletedReadingBookings(authorizationState);
    const paymentAction = ["submitBookingPaymentProof", "reviewBookingPayment", "processPaymentDeadlines"].includes(body.action);
    const rescheduleAction = ["requestBookingReschedule", "reviewBookingReschedule"].includes(body.action);
    const specialAction = paymentAction || rescheduleAction;
    const specialRole = ["submitBookingPaymentProof", "requestBookingReschedule"].includes(body.action) ? "tutee" : "admin";
    const permission = body.action === "processPaymentDeadlines"
      ? user.role === "admin" || user.role === "tutee" ? { ok: true, args: [] } : { ok: false, error: "You are not allowed to perform this action." }
      : specialAction
      ? user.role === specialRole
        ? { ok: true, args: [...body.args] }
        : { ok: false, error: "You are not allowed to perform this action." }
      : authorizeBusinessAction(authorizationState, user, body.action, body.args);
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
      const heldRescheduleSlot = state.bookings.some((entry) => {
        const proposal = entry.rescheduleProposal || entry.scheduleProposal?.__payment?.rescheduleProposal;
        return proposal && requestedSlots.some((slot) => slot.date === proposal.date && slot.time === proposal.time);
      });
      if (heldRescheduleSlot) {
        await connection.rollback();
        return NextResponse.json({ error: "One of those slots is being held for a pending reschedule request." }, { status: 409 });
      }
      const duplicate = state.bookings.some((entry) => {
        if (entry.tuteeId !== user.id || !["pending", "approved", "pending_assessment", "assessment_scheduled", "ready_for_matching", "awaiting_admin", "to_pay", "awaiting_payment_approval", "confirmed"].includes(entry.status)) return false;
        const existingSlots = entry.sessionSlots || entry.dates.map((date) => ({ date, time: entry.sessionTimes?.[date] ?? entry.time }));
        return existingSlots.some((existing) => requestedSlots.some((requested) => existing.date === requested.date && existing.time === requested.time));
      });
      const overlappingSession = state.sessions.some((session) => session.tuteeId === user.id && ["scheduled", "needs_reassignment"].includes(session.status) && requestedSlots.some((requested) => requested.date === session.date && requested.time === session.time));
      if (duplicate || overlappingSession) {
        await connection.rollback();
        return NextResponse.json({ error: "You already have a booking or request at that date and time." }, { status: 409 });
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
    if (body.action === "submitBookingPaymentProof") {
      const [bookingId, receiptData, reference, method] = permission.args;
      const booking = state.bookings.find((entry) => entry.id === bookingId && entry.tuteeId === user.id);
      const assignedSessions = state.sessions.filter((entry) => entry.bookingId === bookingId && entry.status !== "cancelled");
      const isPayable = booking && (booking.status === "to_pay" || (booking.program === "reading" && booking.paymentStatus === "to_pay" && ["ready_for_matching", "confirmed"].includes(booking.status)) || (["awaiting_admin", "ready_for_matching", "confirmed", "approved"].includes(booking.status) && booking.program !== "playgroup" && booking.paymentStatus !== "paid" && bookingSlotsFullyAssigned(booking, assignedSessions)));
      const validReceipt = typeof receiptData === "string" && /^data:(image\/(png|jpeg|webp)|application\/pdf);base64,[A-Za-z0-9+/=]+$/.test(receiptData) && Buffer.from(receiptData.split(",")[1] || "", "base64").byteLength <= 5 * 1024 * 1024;
      if (!isPayable || !validReceipt || (reference != null && (typeof reference !== "string" || reference.length > 120)) || !["online", "in_person"].includes(method)) {
        await connection.rollback();
        return NextResponse.json({ error: "This booking is not awaiting payment, or the receipt file is invalid (5 MB maximum)." }, { status: 400 });
      }
    }
    if (body.action === "reviewBookingPayment") {
      const [bookingId, approve, note] = permission.args;
      const booking = state.bookings.find((entry) => entry.id === bookingId);
      if (!booking || booking.status !== "awaiting_payment_approval") {
        await connection.rollback();
        return NextResponse.json({ error: "This payment proof is no longer awaiting review." }, { status: 409 });
      }
      if (typeof approve !== "boolean" || (note != null && (typeof note !== "string" || note.length > 500)) || (!approve && !String(note || "").trim())) {
        await connection.rollback();
        return NextResponse.json({ error: "Enter a rejection reason of up to 500 characters." }, { status: 400 });
      }
    }
    if (body.action === "requestBookingReschedule") {
      const [bookingId, requestedSessions, reason] = permission.args;
      const booking = state.bookings.find((entry) => entry.id === bookingId && entry.tuteeId === user.id);
      const validRequestList = Array.isArray(requestedSessions) && requestedSessions.length > 0 && requestedSessions.length <= 30 && new Set(requestedSessions.map((entry) => entry.sessionId)).size === requestedSessions.length;
      const matchedRequests = [];
      const available = booking && booking.status === "confirmed" && booking.paymentStatus === "paid" && validRequestList && typeof reason === "string" && reason.trim().length > 0 && reason.length <= 1000 && requestedSessions.every((request) => {
        const { sessionId, date, time } = request || {};
        const session = state.sessions.find((entry) => entry.id === sessionId && entry.bookingId === bookingId && entry.tuteeId === user.id);
        const day = new Date(`${date}T00:00:00Z`).getUTCDay();
        const allowedDay = day === 2 || day === 4 || day === 6 || ((day === 1 || day === 3 || day === 5) && !["10:00", "10:45"].includes(time));
        const subject = booking.sessionSlots?.find((slot) => slot.date === session?.date && slot.time === session?.time)?.subject || booking.sessionSubjects?.[session?.date] || booking.subject;
        const options = { program: booking.program, subject, gradeLevel: booking.gradeLevel, modality: booking.modality, sessionType: booking.sessionType || "one-on-one" };
        const competingProposal = state.bookings.some((entry) => entry.id !== bookingId && (entry.rescheduleProposal?.date === date && entry.rescheduleProposal?.time === time || entry.rescheduleProposal?.sessions?.some((item) => item.date === date && item.time === time)));
        if (!session || session.status !== "scheduled" || session.date < todayISO() || date < todayISO() || !HOURS.includes(time) || !allowedDay || (date === session.date && time === session.time) || competingProposal || !slotRequestable(state, date, time, options, bookingId)) return false;
        const candidates = matchTutors(state, { ...options, learningNeeds: booking.learningNeeds, dates: [date], times: { [date]: time }, time, ignoreBookingId: bookingId }).filter((match) => match.full);
        const chosen = candidates.find((match) => match.tutor.userId === session.tutorId) || candidates[0];
        if (!chosen) return false;
        matchedRequests.push({ sessionId, date, time, tutorId: chosen.tutor.userId });
        return true;
      });
      if (!available) {
        await connection.rollback();
        return NextResponse.json({ error: "Choose an available future slot for every selected session and enter a reason." }, { status: 409 });
      }
      permission.args = [bookingId, matchedRequests, reason.trim()];
    }
    if (body.action === "reviewBookingReschedule") {
      const [bookingId, approve] = permission.args;
      const booking = state.bookings.find((entry) => entry.id === bookingId);
      if (!booking?.rescheduleProposal || typeof approve !== "boolean") {
        await connection.rollback();
        return NextResponse.json({ error: "This reschedule request is no longer pending." }, { status: 409 });
      }
    }

    let nextState = structuredClone(state);
    queueCompletedReadingBookings(nextState);
    const now = Date.now();
    const warningHours = Math.max(1, Number(process.env.BOOKING_EXPIRY_WARNING_HOURS) || 12);
    for (const booking of nextState.bookings) {
      if (["awaiting_admin", "ready_for_matching", "confirmed", "approved"].includes(booking.status) && booking.paymentStatus !== "paid" && booking.program !== "playgroup") {
        const assigned = nextState.sessions.filter((entry) => entry.bookingId === booking.id && entry.status !== "cancelled");
        const fullyAssigned = bookingSlotsFullyAssigned(booking, assigned);
        if (fullyAssigned) {
          booking.status = "to_pay";
          booking.paymentStatus = "to_pay";
          booking.paymentDeadlineAt = new Date(now + 48 * 60 * 60 * 1000).toISOString();
          booking.expiresAt = booking.paymentDeadlineAt;
          booking.paymentAmount = booking.totalFee;
          nextState.notifications.unshift({ id: uid("n"), userId: booking.tuteeId, text: `A tutor was matched to your ${booking.subject} booking. Please submit payment proof within 48 hours to confirm your reservation.`, at: nowISO(), read: false, channels: ["web", "email", "sms"] });
          for (const admin of nextState.users.filter((entry) => entry.role === "admin")) nextState.notifications.unshift({ id: uid("n"), userId: admin.id, text: `${booking.subject} booking from ${personName(nextState, booking.tuteeId)} was matched and is awaiting payment within 48 hours.`, at: nowISO(), read: false, channels: ["web"] });
        }
      }
      if (!(booking.status === "to_pay" || (booking.program === "reading" && booking.paymentStatus === "to_pay" && booking.status === "ready_for_matching")) || !booking.paymentDeadlineAt) continue;
      const expiresAt = Date.parse(booking.paymentDeadlineAt);
      if (expiresAt <= now) {
        booking.status = "expired";
        booking.bookingStatus = "expired";
        booking.paymentStatus = "expired";
        if (booking.program === "playgroup" && booking.cohortId) {
          const cohort = nextState.cohorts.find((entry) => entry.id === booking.cohortId);
          if (cohort) cohort.enrolled = (cohort.enrolled || []).filter((tuteeId) => tuteeId !== booking.tuteeId);
        }
        for (const session of nextState.sessions.filter((entry) => entry.bookingId === booking.id && ["awaiting_payment", "scheduled"].includes(entry.status))) session.status = "cancelled";
        const text = `Payment deadline expired for ${booking.subject} booking from ${personName(nextState, booking.tuteeId)}; its reserved capacity was released.`;
        nextState.notifications.unshift({ id: uid("n"), userId: booking.tuteeId, text: "Your booking reservation expired because payment proof was not submitted before the 48-hour deadline.", at: nowISO(), read: false, channels: ["web", "email"] });
        for (const admin of nextState.users.filter((entry) => entry.role === "admin")) nextState.notifications.unshift({ id: uid("n"), userId: admin.id, text, at: nowISO(), read: false, channels: ["web"] });
      } else if (!booking.expirationWarningAt && expiresAt - now <= warningHours * 3600000) {
        booking.expirationWarningAt = nowISO();
        for (const admin of nextState.users.filter((entry) => entry.role === "admin")) nextState.notifications.unshift({ id: uid("n"), userId: admin.id, text: `Payment deadline for ${booking.subject} booking from ${personName(nextState, booking.tuteeId)} is approaching.`, at: nowISO(), read: false, channels: ["web"] });
      }
    }
    const actions = createBusinessActions({
      actorId: user.id,
      get: () => nextState,
      mutate: (update) => {
      const draft = structuredClone(nextState);
        const result = update(draft);
        nextState = draft;
        return result;
      },
    });
    const handler = body.action === "processPaymentDeadlines"
      ? async () => ({ ok: true })
      : body.action === "cancelPlaygroupBooking" && permission.args[0]
      ? async (bookingId) => {
        const booking = nextState.bookings.find((entry) => entry.id === bookingId && entry.tuteeId === user.id && entry.program === "playgroup");
        if (!booking || booking.status !== "to_pay") return actions.cancelPlaygroupBooking(bookingId);
        booking.status = "cancelled";
        booking.bookingStatus = "cancelled";
        booking.paymentStatus = "cancelled";
        booking.tutorAssignmentStatus = "cancelled";
        booking.tutorAssignments = {};
        booking.tutorId = undefined;
        const cohort = nextState.cohorts.find((entry) => entry.id === booking.cohortId);
        if (cohort) cohort.enrolled = (cohort.enrolled || []).filter((tuteeId) => tuteeId !== booking.tuteeId);
        nextState.notifications.unshift({ id: uid("n"), userId: user.id, text: `Your Playgroup booking${cohort ? ` for ${cohort.label}` : ""} was cancelled and its slot released.`, at: nowISO(), read: false, channels: ["web", "email"] });
        for (const admin of nextState.users.filter((entry) => entry.role === "admin")) nextState.notifications.unshift({ id: uid("n"), userId: admin.id, text: `${personName(nextState, user.id)} cancelled their Playgroup booking${cohort ? ` for ${cohort.label}` : ""} before payment.`, at: nowISO(), read: false, channels: ["web"] });
        return { ok: true };
      }
      : body.action === "cancelTutorialBooking" && permission.args[0]
      ? async (bookingId) => {
        const booking = nextState.bookings.find((entry) => entry.id === bookingId && entry.tuteeId === user.id);
        if (!booking || !["to_pay", "awaiting_payment_approval"].includes(booking.status)) return actions.cancelTutorialBooking(bookingId);
        booking.status = "cancelled";
        booking.paymentStatus = "cancelled";
        booking.paymentProof = undefined;
        nextState.sessions.filter((session) => session.bookingId === bookingId && session.status !== "completed").forEach((session) => { session.status = "cancelled"; });
        nextState.notifications.unshift({ id: uid("n"), userId: user.id, text: `Your ${booking.subject} booking was cancelled and its reservation was released.`, at: nowISO(), read: false, channels: ["web", "email"] });
        for (const admin of nextState.users.filter((entry) => entry.role === "admin")) nextState.notifications.unshift({ id: uid("n"), userId: admin.id, text: `${personName(nextState, user.id)} cancelled a ${booking.subject} booking before completing payment.`, at: nowISO(), read: false, channels: ["web"] });
        return { ok: true };
      }
      : body.action === "requestBookingReschedule"
      ? async (bookingId, requestedSessions, reason) => {
        const booking = nextState.bookings.find((entry) => entry.id === bookingId && entry.tuteeId === user.id);
        if (!booking || booking.status !== "confirmed" || booking.paymentStatus !== "paid") return { ok: false, error: "Only a paid, confirmed booking can be rescheduled." };
        const proposedSessions = requestedSessions.map((request) => {
          const current = nextState.sessions.find((entry) => entry.id === request.sessionId && entry.bookingId === bookingId && entry.status === "scheduled");
          return current && { sessionId: current.id, original: { date: current.date, time: current.time, tutorId: current.tutorId }, date: request.date, time: request.time, tutorId: request.tutorId };
        });
        if (proposedSessions.some((entry) => !entry)) return { ok: false, error: "A selected session is no longer available to reschedule." };
        booking.rescheduleProposal = { ...proposedSessions[0], sessions: proposedSessions, reason, requestedAt: nowISO() };
        logActivity(nextState, user.id, `Requested a schedule change for ${booking.subject} program`);
        for (const admin of nextState.users.filter((entry) => entry.role === "admin")) nextState.notifications.unshift({ id: uid("n"), userId: admin.id, text: `${personName(nextState, user.id)} requested a reschedule for ${booking.subject} (${proposedSessions.map((item) => `${item.date} at ${item.time}`).join(", ")}). Reason: ${reason}`, at: nowISO(), read: false, channels: ["web", "email"] });
        return { ok: true };
      }
      : body.action === "reviewBookingReschedule"
        ? async (bookingId, approve, tutorChoices = {}) => {
          const booking = nextState.bookings.find((entry) => entry.id === bookingId && entry.rescheduleProposal);
          if (!booking) return { ok: false, error: "This reschedule request is no longer pending." };
          const proposal = booking.rescheduleProposal;
          const proposals = (proposal.sessions || [proposal]).map((item) => ({ ...item, tutorId: tutorChoices?.[item.sessionId] || item.tutorId }));
          const targets = proposals.map((item) => ({ proposal: item, session: nextState.sessions.find((entry) => entry.id === item.sessionId && entry.bookingId === booking.id && entry.status === "scheduled") }));
          if (targets.some((item) => !item.session)) return { ok: false, error: "An original session can no longer be rescheduled." };
          const oldTutorIds = targets.map(({ session }) => session.tutorId);
          if (approve) {
            if (new Set(proposals.map((item) => `${item.date}|${item.time}`)).size !== proposals.length) return { ok: false, error: "Selected sessions cannot use the same new slot." };
            for (const { proposal: item, session } of targets) {
              const subject = booking.sessionSlots?.find((slot) => slot.date === session.date && slot.time === session.time)?.subject || booking.sessionSubjects?.[session.date] || booking.subject;
              const options = { program: booking.program, subject, gradeLevel: booking.gradeLevel, modality: booking.modality, sessionType: booking.sessionType || "one-on-one", learningNeeds: booking.learningNeeds };
              if (!slotRequestable(nextState, item.date, item.time, options, booking.id)) return { ok: false, error: "A requested slot is no longer available." };
              const tutors = matchTutors(nextState, { ...options, dates: [item.date], times: { [item.date]: item.time }, time: item.time, ignoreBookingId: booking.id }).filter((match) => match.full);
              if (!tutors.some((match) => match.tutor.userId === item.tutorId)) return { ok: false, error: "An assigned tutor is no longer available for a requested slot." };
            }
            for (const { proposal: item, session } of targets) {
              const oldSchedule = { date: session.date, time: session.time, tutorId: session.tutorId };
              session.date = item.date; session.time = item.time; session.tutorId = item.tutorId;
              const preservedDates = (booking.dates || []).filter((entry) => entry !== oldSchedule.date);
              booking.dates = [...new Set([...preservedDates, item.date])].sort();
              booking.sessionTimes = { ...(booking.sessionTimes || {}) };
              delete booking.sessionTimes[oldSchedule.date]; booking.sessionTimes[item.date] = item.time;
              booking.sessionSubjects = { ...(booking.sessionSubjects || {}) };
              if (booking.sessionSubjects[oldSchedule.date]) { booking.sessionSubjects[item.date] = booking.sessionSubjects[oldSchedule.date]; delete booking.sessionSubjects[oldSchedule.date]; }
              if (booking.sessionSlots) booking.sessionSlots = booking.sessionSlots.map((slot) => slot.date === oldSchedule.date && slot.time === oldSchedule.time ? { ...slot, date: item.date, time: item.time } : slot);
              booking.scheduleHistory = [...(booking.scheduleHistory || []), { old: oldSchedule, updated: { date: item.date, time: item.time, tutorId: item.tutorId }, changedAt: nowISO() }];
            }
            nextState.notifications.unshift({ id: uid("n"), userId: booking.tuteeId, text: `Your reschedule request was approved: ${proposals.map((item) => `${item.date} at ${item.time}`).join(", ")}.`, at: nowISO(), read: false, channels: ["web", "email"] });
            for (const tutorId of new Set([...oldTutorIds, ...proposals.map((item) => item.tutorId)])) nextState.notifications.unshift({ id: uid("n"), userId: tutorId, text: `The reschedule for ${booking.subject} booking from ${personName(nextState, booking.tuteeId)} was approved.`, at: nowISO(), read: false, channels: ["web", "email"] });
          } else {
            nextState.notifications.unshift({ id: uid("n"), userId: booking.tuteeId, text: "Your reschedule request was declined. The original session time remains unchanged.", at: nowISO(), read: false, channels: ["web", "email"] });
            for (const tutorId of new Set(oldTutorIds)) nextState.notifications.unshift({ id: uid("n"), userId: tutorId, text: `The reschedule request for ${booking.subject} booking from ${personName(nextState, booking.tuteeId)} was declined; your original session remains scheduled.`, at: nowISO(), read: false, channels: ["web", "email"] });
          }
          const tuteeName = personName(nextState, booking.tuteeId);
          logActivity(nextState, user.id, `${approve ? "Approved" : "Declined"} ${tuteeName}'s ${booking.subject} schedule change request: ${(approve ? proposals : []).map((item) => `${item.date} at ${item.time}`).join(", ") || "original schedule retained"}`);
          booking.rescheduleProposal = undefined;
          return { ok: true };
        }
        : body.action === "submitBookingPaymentProof"
      ? async (bookingId, receiptData, reference, method) => {
        const booking = nextState.bookings.find((entry) => entry.id === bookingId && entry.tuteeId === user.id);
        if (!booking || !(booking.status === "to_pay" || (booking.program === "reading" && booking.paymentStatus === "to_pay" && ["ready_for_matching", "confirmed"].includes(booking.status)))) return { ok: false, error: "This booking is no longer awaiting payment." };
        booking.paymentProof = { receiptData, reference: reference || "", method, submittedAt: nowISO() };
        booking.paymentStatus = "awaiting_approval";
        booking.status = "awaiting_payment_approval";
        booking.expirationWarningAt = undefined;
        logActivity(nextState, user.id, `Submitted payment receipt for ${booking.subject} program`);
        nextState.notifications.unshift({ id: uid("n"), userId: user.id, text: `Payment proof received for ${booking.subject}. Your reservation remains active while it is reviewed.`, at: nowISO(), read: false, channels: ["web", "email"] });
        for (const admin of nextState.users.filter((entry) => entry.role === "admin")) nextState.notifications.unshift({ id: uid("n"), userId: admin.id, text: `Payment proof for ${booking.subject} booking from ${personName(nextState, user.id)} is awaiting verification.`, at: nowISO(), read: false, channels: ["web", "email"] });
        return { ok: true };
      }
      : body.action === "reviewBookingPayment"
        ? async (bookingId, approve, note) => {
          const booking = nextState.bookings.find((entry) => entry.id === bookingId && entry.status === "awaiting_payment_approval");
          if (!booking) return { ok: false, error: "This payment proof is no longer awaiting review." };
          booking.paymentReviewNote = note || "";
          booking.paymentReviewedAt = nowISO();
          if (approve) {
            booking.status = "confirmed";
            booking.paymentStatus = "paid";
            booking.paymentApprovedAt = nowISO();
            logActivity(nextState, user.id, `Approved ${booking.subject} payment receipt from ${personName(nextState, booking.tuteeId)}`);
            for (const session of nextState.sessions.filter((entry) => entry.bookingId === booking.id && entry.status === "awaiting_payment")) session.status = "scheduled";
            nextState.notifications.unshift({ id: uid("n"), userId: booking.tuteeId, text: `Your payment was approved. ${booking.subject} booking is confirmed and now appears on your schedule.`, at: nowISO(), read: false, channels: ["web", "email"] });
            for (const tutorId of new Set(nextState.sessions.filter((entry) => entry.bookingId === booking.id).map((entry) => entry.tutorId))) nextState.notifications.unshift({ id: uid("n"), userId: tutorId, text: `Payment for ${booking.subject} booking from ${personName(nextState, booking.tuteeId)} was approved; the sessions are confirmed.`, at: nowISO(), read: false, channels: ["web", "email"] });
          } else {
            logActivity(nextState, user.id, `Rejected ${booking.subject} payment receipt from ${personName(nextState, booking.tuteeId)}${note ? `: ${note}` : ""}`);
            booking.status = "to_pay";
            booking.paymentStatus = "proof_rejected";
            booking.paymentProofHistory = [...(booking.paymentProofHistory || []), {
              method: booking.paymentProof?.method,
              reference: booking.paymentProof?.reference || "",
              submittedAt: booking.paymentProof?.submittedAt,
              reviewedAt: booking.paymentReviewedAt,
              reviewNote: booking.paymentReviewNote,
              status: "rejected",
            }];
            booking.paymentProof = undefined;
            booking.paymentDeadlineAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
            booking.expiresAt = booking.paymentDeadlineAt;
            nextState.notifications.unshift({ id: uid("n"), userId: booking.tuteeId, text: `Your payment proof for ${booking.subject} could not be approved.${note ? ` ${note}` : " Please submit a new receipt."}`, at: nowISO(), read: false, channels: ["web", "email"] });
          }
          return { ok: true };
        }
        : actions[body.action];
    if (typeof handler !== "function") {
      await connection.rollback();
      return NextResponse.json({ error: "Unknown app action." }, { status: 404 });
    }

    const existingNotificationIds = new Set(nextState.notifications.map((entry) => entry.id));
    const result = await handler(...permission.args);
    if (result && result.ok === false) {
      await connection.rollback();
      return NextResponse.json({ error: result.error, result, db: stateVisibleToUser(nextState, user) }, { status: 409 });
    }
    const matchingActions = ["confirmBooking", "confirmBookingSession", "confirmReadingAssignment"];
    const autoPairedIds = body.action === "submitTutorialBooking" && result?.autoPaired ? [result.bookingId] : [];
    if (matchingActions.includes(body.action) || autoPairedIds.length) {
      const requestedIds = autoPairedIds.length ? autoPairedIds : body.action === "confirmReadingAssignment" ? permission.args[0] : [permission.args[0]];
      for (const booking of nextState.bookings.filter((entry) => requestedIds.includes(entry.id))) {
        const sessions = nextState.sessions.filter((entry) => entry.bookingId === booking.id && entry.status !== "cancelled");
        const fullyAssigned = bookingSlotsFullyAssigned(booking, sessions);
        if (booking.status !== "confirmed" || !fullyAssigned || ["paid", "awaiting_approval"].includes(booking.paymentStatus)) continue;
        const prematureConfirmed = nextState.notifications.filter((entry) => !existingNotificationIds.has(entry.id) && entry.userId === booking.tuteeId && /confirmed/i.test(entry.text));
        if (prematureConfirmed.length) {
          const prematureIds = new Set(prematureConfirmed.map((entry) => entry.id));
          nextState.notifications = nextState.notifications.filter((entry) => !prematureIds.has(entry.id));
        }
        booking.status = "to_pay";
        booking.paymentStatus = "to_pay";
        booking.paymentDeadlineAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
        booking.expiresAt = booking.paymentDeadlineAt;
        booking.paymentAmount = booking.totalFee;
        for (const session of sessions) session.status = "scheduled";
        nextState.notifications.unshift({ id: uid("n"), userId: booking.tuteeId, text: `A tutor was matched to your ${booking.subject} booking. Please submit payment proof within 48 hours to confirm your reservation.`, at: nowISO(), read: false, channels: ["web", "email", "sms"] });
        for (const admin of nextState.users.filter((entry) => entry.role === "admin")) nextState.notifications.unshift({ id: uid("n"), userId: admin.id, text: `${booking.subject} booking from ${personName(nextState, booking.tuteeId)} was matched and is awaiting payment within 48 hours.`, at: nowISO(), read: false, channels: ["web"] });
      }
    }
    queueCompletedReadingBookings(nextState);
    await persistRelationalState(connection, packExtendedState(nextState), packExtendedState(state));
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
