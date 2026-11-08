import { BASE_RATES, FACE_TO_FACE_PREMIUM, HOURS, PLAYGROUP_MONTHLY_FEE, READING_PREMIUM, bandOf, } from "./constants";
import { addDays, parseISO, rangeDates, todayISO, weekday } from "./dates";
// ---------- Rates ----------
export function computeRate(program, grade, modality) {
    if (program === "playgroup")
        return PLAYGROUP_MONTHLY_FEE;
    let rate = BASE_RATES[bandOf(grade || "Grade 1")];
    if (program === "reading")
        rate += READING_PREMIUM;
    if (modality === "face-to-face")
        rate += FACE_TO_FACE_PREMIUM;
    return rate;
}
// ---------- Dates for a booking ----------
export function expandBookingDates(opts) {
    if (opts.type === "one-time")
        return opts.date ? [opts.date] : [];
    if (!opts.start || !opts.end || !opts.days?.length)
        return [];
    return rangeDates(opts.start, opts.end).filter((d) => opts.days.includes(weekday(d)));
}
// ---------- Leave / availability / sessions ----------
export function onApprovedLeave(db, tutorId, date) {
    return db.leaves.some((l) => l.tutorId === tutorId && l.status === "approved" && date >= l.startDate && date <= l.endDate);
}
/** Only ADMIN-APPROVED availability counts. Pending/rejected are ignored. */
export function approvedSlot(db, tutorId, date, time, modality) {
    const weekly = db.tutorSchedules?.[tutorId];
    if (weekly) {
        const day = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][weekday(date)];
        return !!weekly.days?.[day] && (weekly.modalities || ["online", "face-to-face"]).includes(modality);
    }
    return db.availability.some((a) => a.tutorId === tutorId &&
        a.status === "approved" &&
        a.date === date &&
        a.slots.includes(time) &&
        a.modalities.includes(modality));
}
export function tutorBusy(db, tutorId, date, time, ignoreBookingId, sessionType = "one-on-one") {
    const active = db.sessions.filter((s) => s.tutorId === tutorId && s.date === date && s.time === time &&
        (s.status === "scheduled" || s.status === "needs_reassignment") && s.bookingId !== ignoreBookingId);
    if (!active.length) return false;
    const groups = sessionType === "group" && active.every((s) => db.bookings.find((b) => b.id === s.bookingId)?.sessionType === "group");
    // Group bookings share one tutor assignment, with a hard two-student ceiling.
    return !groups || active.length >= 2;
}
export function tutorAssessmentBusy(db, tutorId, date, time) {
    return tutorBusy(db, tutorId, date, time);
}
/** Center slot capacity is derived from eligible tutors; pending requests reserve seats. */
export function remainingCapacity(db, date, time, options = {}, ignoreBookingId, ignoreSessionId) {
    const program = options.program ?? "academic";
    const sessionType = options.sessionType ?? "one-on-one";
    const modality = options.modality ?? "online";
    const base = { program, subject: options.subject ?? (program === "reading" ? "Reading" : "English"), gradeLevel: options.gradeLevel ?? "Grade 1", modality, sessionType };
    const eligible = db.tutors.filter((t) => tutorQualifies(t, base) && approvedSlot(db, t.userId, date, time, modality) && !onApprovedLeave(db, t.userId, date));
    const eligibleIds = new Set(eligible.map((tutor) => tutor.userId));
    const capacity = eligible.length * (program === "academic" && sessionType === "group" ? 2 : 1);
    let used = db.sessions.filter((s) => {
        if (s.id === ignoreSessionId || s.date !== date || s.time !== time || !["scheduled", "needs_reassignment"].includes(s.status)) return false;
        const booking = db.bookings.find((b) => b.id === s.bookingId);
        return eligibleIds.has(s.tutorId) && booking?.program === program && (booking?.sessionType ?? "one-on-one") === sessionType;
    }).length;
    used += db.bookings.filter((b) => b.id !== ignoreBookingId && b.program !== "playgroup" && b.status === "awaiting_admin" && b.program === program && (b.sessionType ?? "one-on-one") === sessionType && b.dates.includes(date) && (b.sessionTimes?.[date] ?? b.time) === time).length;
    return Math.max(0, capacity - used);
}
export function slotOccupied(db, date, time, ignoreBookingId, ignoreSessionId, options = {}) {
    return remainingCapacity(db, date, time, options, ignoreBookingId, ignoreSessionId) === 0;
}
export function hasOpenSlot(db, date) {
    return HOURS.some((time) => !slotOccupied(db, date, time));
}
// ---------- Ratings ----------
export function tutorRating(db, tutorId) {
    const rated = db.sessions.filter((s) => s.tutorId === tutorId && typeof s.rating === "number");
    if (!rated.length)
        return null;
    return rated.reduce((a, s) => a + (s.rating || 0), 0) / rated.length;
}
export function bookingTimeOnDate(booking, date) {
    return booking.sessionTimes?.[date] ?? booking.time;
}
export function tutorQualifies(t, p) {
    if (t.status !== "active")
        return false;
    const needSubject = p.program === "reading" ? ["Reading"] : p.subject === "Mathematics" || p.subject === "Math" ? ["Mathematics", "Math"] : p.subject === "Araling Panlipunan (AP)" ? ["Araling Panlipunan (AP)", "Araling Panlipunan", "AP"] : [p.subject];
    if (!t.subjects.some((subject) => needSubject.includes(subject)))
        return false;
    return t.gradeBands.includes(bandOf(p.gradeLevel));
}
export function tutorFreeOn(db, t, p, date) {
    const time = p.times?.[date] ?? p.time;
    if (date < todayISO())
        return false;
    if (!approvedSlot(db, t.userId, date, time, p.modality))
        return false;
    if (onApprovedLeave(db, t.userId, date))
        return false;
    if (tutorBusy(db, t.userId, date, time, p.ignoreBookingId, p.sessionType))
        return false;
    return true;
}
export function matchTutors(db, p) {
    const out = [];
    for (const t of db.tutors) {
        if (!tutorQualifies(t, p))
            continue;
        const ok = p.dates.filter((d) => tutorFreeOn(db, t, p, d));
        if (!ok.length)
            continue;
        const rating = tutorRating(db, t.userId);
        const full = ok.length === p.dates.length;
        const gradeScore = t.gradeBands.includes(bandOf(p.gradeLevel)) ? 25 : 0;
        const scheduleScore = (ok.length / p.dates.length) * 40;
        const subjectScore = tutorQualifies(t, p) ? 35 : 0;
        const score = gradeScore + scheduleScore + subjectScore;
        out.push({
            tutor: t,
            coverage: ok.length,
            total: p.dates.length,
            full,
            gradeScore,
            scheduleScore,
            subjectScore,
            score,
            rating,
            missingDates: p.dates.filter((d) => !ok.includes(d)),
        });
    }
    return out.sort((a, b) => b.score - a.score);
}
/** Time slots on a date with number of compatible tutors who are free. */
export function timesForDate(db, base, date) {
    const day = weekday(date);
    const hours = day === 1 || day === 3 || day === 5
        ? ["12:00", "12:45", "13:30", "14:15", "15:00", "15:45", "16:30", "17:15"]
        : day === 2 || day === 4 || day === 6 ? HOURS : [];
    return hours.map((time) => {
        const m = matchTutors(db, { ...base, dates: [date], time });
        return { time, count: remainingCapacity(db, date, time, base) };
    });
}
export function dateHasTutors(db, base, date) {
    return timesForDate(db, base, date).some((t) => t.count > 0);
}
/** Alternative slots: first on same date other hours, then upcoming days. */
export function alternativeSlots(db, base, aroundDate, limit = 8) {
    const out = [];
    const startFrom = aroundDate < todayISO() ? todayISO() : aroundDate;
    for (let i = 0; i < 30 && out.length < limit; i++) {
        const date = addDays(startFrom, i);
        for (const t of timesForDate(db, base, date)) {
            if (t.count > 0 && out.length < limit)
                out.push({ date, time: t.time, count: t.count });
        }
    }
    return out;
}
// ---------- Playgroup ----------
export function cohortSessionDates(c) {
    const dates = [];
    let cur = c.startDate;
    let guard = 0;
    while (dates.length < c.sessionsCount && guard++ < 120) {
        if (c.weekdays.includes(weekday(cur)))
            dates.push(cur);
        cur = addDays(cur, 1);
    }
    return dates;
}
export function isPastSession(date, time) {
    const d = parseISO(date);
    const [h, m] = time.split(":").map(Number);
    d.setHours(h + 1, m, 0, 0);
    return d.getTime() < Date.now();
}
