"use client";
import { useState } from "react";
import { Alert, Badge, Button, Card, Empty, Field, FilterPopover, FilterTrigger, Input, Modal, PageHeader, ProfileModal, Select, Textarea, peso } from "@/components/ui";
import { addDays, fmtDate, fmtTime, todayISO } from "@/lib/dates";
import { HOURS } from "@/lib/constants";
import { matchTutors } from "@/lib/logic";
import { isAssessmentOutdated } from "@/lib/dates";
import { useStore } from "@/lib/store";
import { openPdfDataUrl } from "@/lib/files";

function sessionEndTime(time) {
  const [hour, minute] = time.split(":").map(Number);
  const end = new Date(2000, 0, 1, hour, minute + 45);
  return `${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`;
}
const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function Matching({ embedded = false, programFilter = null, tuteeFilter = null, initialSelectedId = null, cardLayout = false, showReschedules = true } = {}) {
  const s = useStore();
  const [msg, setMsg] = useState({});
  const [selectedId, setSelectedId] = useState(initialSelectedId);
  const [rej, setRej] = useState(null);
  const [reason, setReason] = useState("The requested schedule is not available.");
  const [editing, setEditing] = useState(null);
  const [scheduleDraft, setScheduleDraft] = useState([]);
  const [scheduleError, setScheduleError] = useState("");
  const [readingTutorChoice, setReadingTutorChoice] = useState({});
  const [academicTutorChoices, setAcademicTutorChoices] = useState({});
  const [assignmentBusy, setAssignmentBusy] = useState(false);
  const [rescheduleTutorChoice, setRescheduleTutorChoice] = useState({});
  const [rescheduleErrors, setRescheduleErrors] = useState({});
  const [rescheduleBusy, setRescheduleBusy] = useState({});
  const [sortOrder, setSortOrder] = useState("newest");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [scheduleModal, setScheduleModal] = useState(null);
  const [profileTutorId, setProfileTutorId] = useState(null);
  const sortByCreatedAt = (a, b) => {
    const comparison = String(a.createdAt || "").localeCompare(String(b.createdAt || ""));
    return sortOrder === "newest" ? -comparison : comparison;
  };
  const allPending = s.db.bookings.filter((b) => (!programFilter || b.program === programFilter) && (!tuteeFilter || b.tuteeId === tuteeFilter) && (["awaiting_admin", "ready_for_matching"].includes(b.status) || (b.program === "reading" && ["to_pay", "awaiting_payment_approval", "confirmed"].includes(b.status) && !(b.sessionSlots ?? b.dates.map((date) => ({ date, time: b.sessionTimes?.[date] ?? b.time }))).every((slot) => s.db.sessions.some((session) => session.bookingId === b.id && session.date === slot.date && session.time === slot.time && session.tutorId && session.status !== "cancelled"))))
    && (b.program !== "reading" || s.db.assessments.some((a) => a.id === b.assessmentId && a.tuteeId === b.tuteeId && a.status === "completed" && !isAssessmentOutdated(a)))).sort(sortByCreatedAt);
  const pending = allPending.filter((booking, index) => booking.program !== "reading" || allPending.findIndex((other) => other.program === "reading" && other.tuteeId === booking.tuteeId && other.assessmentId === booking.assessmentId) === index);
  const booking = pending.find((b) => b.id === selectedId);
  const bookingGroup = booking?.program === "reading" ? allPending.filter((entry) => entry.program === "reading" && entry.tuteeId === booking.tuteeId && entry.assessmentId === booking.assessmentId) : booking ? [booking] : [];
  const rejectedGroup = rej?.program === "reading" ? allPending.filter((entry) => entry.program === "reading" && entry.tuteeId === rej.tuteeId && entry.assessmentId === rej.assessmentId) : [];
  const readingSlotMap = new Map();
  bookingGroup.forEach((entry) => (entry.sessionSlots ?? entry.dates.map((date) => ({ date, time: entry.sessionTimes?.[date] ?? entry.time, subject: "Reading" }))).forEach((slot) => readingSlotMap.set(`${slot.date}|${slot.time}`, { ...slot, subject: "Reading" })));
  const readingSlots = [...readingSlotMap.values()].sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  const tutee = booking && s.db.tutees.find((t) => t.userId === booking.tuteeId);
  const profileTutor = profileTutorId ? s.db.tutors.find((tutor) => tutor.userId === profileTutorId) : null;
  const profileTutorEmail = profileTutor ? s.db.users.find((user) => user.id === profileTutor.userId)?.email : "";
  const profileTutorStudents = profileTutor ? [...new Set(s.db.sessions.filter((session) => session.tutorId === profileTutor.userId && session.status !== "cancelled").map((session) => s.db.tutees.find((row) => row.userId === session.tuteeId)?.fullName).filter(Boolean))] : [];
  const assessment = booking?.assessmentId ? s.db.assessments.find((a) => a.id === booking.assessmentId) : undefined;
  const proposalPending = !!booking?.scheduleProposal;
  const individual = booking?.program === "academic" || booking?.program === "reading";
  const assignments = booking ? s.db.sessions.filter((session) => session.bookingId === booking.id && session.status !== "cancelled") : [];
  const sessions = (() => {
    if (!booking || !individual || proposalPending) return [];
    const groups = new Map();
    const requestedSlots = booking.sessionSlots ?? booking.dates.map((date) => ({ seriesKey: `day-${new Date(`${date}T00:00:00Z`).getUTCDay()}`, day: new Date(`${date}T00:00:00Z`).getUTCDay(), date, subject: booking.sessionSubjects?.[date] ?? booking.subject, time: booking.sessionTimes?.[date] ?? booking.time }));
    for (const slot of requestedSlots) {
      const key = booking.sessionType === "group" ? `${slot.date}|${slot.time}` : slot.seriesKey;
      if (!groups.has(key)) groups.set(key, { key, day: slot.day, subject: slot.subject, time: slot.time, slots: [] });
      groups.get(key).slots.push(slot);
    }
    return [...groups.values()].sort((a, b) => a.slots[0].date.localeCompare(b.slots[0].date) || a.time.localeCompare(b.time)).map((group) => {
      const assignedSessions = group.slots.map((slot) => assignments.find((session) => session.date === slot.date && session.time === slot.time)).filter(Boolean);
      const assigned = assignedSessions.length === group.slots.length && new Set(assignedSessions.map((session) => session.tutorId)).size === 1 ? assignedSessions[0] : null;
      const ranked = matchTutors(s.db, {
        program: booking.program, subject: group.subject, gradeLevel: booking.gradeLevel, modality: booking.modality, learningNeeds: booking.learningNeeds,
        sessionType: booking.sessionType ?? "one-on-one", dates: group.slots.map((slot) => slot.date), time: group.time,
        times: Object.fromEntries(group.slots.map((slot) => [slot.date, group.time])), ignoreBookingId: booking.id,
      }).filter((match) => match.full);
      const assignedMatch = assigned ? ranked.find((match) => match.tutor.userId === assigned.tutorId) : null;
      const matches = assignedMatch ? [assignedMatch, ...ranked.filter((match) => match.tutor.userId !== assigned.tutorId)].slice(0, 3) : ranked.slice(0, 3);
      return { ...group, dates: group.slots.map((slot) => slot.date), assigned, eligibleCount: ranked.length, matches };
    });
  })();
  const openScheduleEditor = (b) => {
    setEditing(b);
    setScheduleError("");
    setScheduleDraft(b.scheduleProposal?.sessions ?? b.dates.map((date) => ({ date, time: b.sessionTimes?.[date] ?? b.time })));
  };
  const showError = (id, result) => setMsg((current) => ({ ...current, [id]: result.ok ? "" : result.error }));
  const assignSession = async (slots, tutorId) => showError(booking.id, await s.confirmBookingSession(booking.id, slots, tutorId));
  const assignWholeBooking = async (tutorId) => showError(booking.id, booking.program === "reading" ? await s.confirmReadingAssignment(bookingGroup.map((entry) => entry.id), tutorId) : await s.confirmBooking(booking.id, tutorId));
  const readingMatches = booking?.program === "reading" ? matchTutors(s.db, { program: "reading", subject: "Reading", gradeLevel: booking.gradeLevel, modality: booking.modality, learningNeeds: booking.learningNeeds, dates: readingSlots.map((slot) => slot.date), times: Object.fromEntries(readingSlots.map((slot) => [slot.date, slot.time])), time: booking.time, ignoreBookingId: booking.id }).filter((match) => match.full) : [];
  const suggestedTutorId = booking?.recommendations?.find((id) => readingMatches.some((match) => match.tutor.userId === id)) ?? readingMatches[0]?.tutor.userId;
  const selectedReadingTutor = readingTutorChoice[booking?.id] ?? suggestedTutorId;
  const confirmSelectedAssignments = async () => {
    if (!booking) return;
    setAssignmentBusy(true);
    if (booking.program === "reading") {
      await assignWholeBooking(selectedReadingTutor);
    } else {
      const choices = academicTutorChoices[booking.id] || {};
      for (const session of sessions) {
        const tutorId = choices[session.key] || session.assigned?.tutorId;
        if (tutorId && !session.assigned) await assignSession(session.slots, tutorId);
      }
    }
    setAssignmentBusy(false);
  };
  const pendingReschedules = s.db.bookings.filter((entry) => (!programFilter || entry.program === programFilter) && (!tuteeFilter || entry.tuteeId === tuteeFilter) && entry.rescheduleProposal).sort(sortByCreatedAt);
  const rescheduleOptions = (entry, item) => {
    const subject = entry.sessionSlots?.find((slot) => slot.date === item.original.date && slot.time === item.original.time)?.subject || entry.sessionSubjects?.[item.original.date] || entry.subject;
    return matchTutors(s.db, { program: entry.program, subject, gradeLevel: entry.gradeLevel, modality: entry.modality, learningNeeds: entry.learningNeeds, sessionType: entry.sessionType || "one-on-one", dates: [item.date], times: { [item.date]: item.time }, time: item.time, ignoreBookingId: entry.id })
      .filter((match) => match.full);
  };
  const reviewReschedule = async (entry, approve) => {
    const items = entry.rescheduleProposal.sessions || [entry.rescheduleProposal];
    const tutors = Object.fromEntries(items.map((item) => {
      const options = rescheduleOptions(entry, item);
      const preferred = rescheduleTutorChoice[`${entry.id}:${item.sessionId}`] || item.tutorId;
      return [item.sessionId, options.some((match) => match.tutor.userId === preferred) ? preferred : options[0]?.tutor.userId || ""];
    }));
    if (approve && Object.values(tutors).some((tutorId) => !tutorId)) {
      setRescheduleErrors((current) => ({ ...current, [entry.id]: "No tutor is available for one or more requested sessions." }));
      return;
    }
    setRescheduleBusy((current) => ({ ...current, [entry.id]: true }));
    const response = await fetch("/api/state/action", { method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ action: "reviewBookingReschedule", args: [entry.id, approve, tutors] }) });
    const payload = await response.json().catch(() => ({}));
    setRescheduleBusy((current) => ({ ...current, [entry.id]: false }));
    if (!response.ok) setRescheduleErrors((current) => ({ ...current, [entry.id]: payload.error || "Could not review this request." }));
    else window.location.reload();
  };

  return <>
    {!embedded && <PageHeader title="Tutor–tutee matching" subtitle="Review each booking, then assign tutors to its sessions."/>}
    {!booking && (pending.length > 0 || (showReschedules && pendingReschedules.length > 0)) && <div className="relative mb-3 flex justify-end"><FilterTrigger onClick={() => setFiltersOpen((open) => !open)} ariaLabel="Filter booking requests" expanded={filtersOpen} count={sortOrder !== "newest" ? 1 : 0}/>{filtersOpen && <FilterPopover onClear={() => setSortOrder("newest")} onApply={() => setFiltersOpen(false)}><fieldset><legend className="mb-2 text-xs font-extrabold text-slate-700">Sort by</legend><div className="space-y-1">{[["newest", "Newest first"], ["oldest", "Oldest first"]].map(([value, label]) => <label key={value} className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 hover:bg-brand-50"><input type="radio" name="academic-booking-request-sort" checked={sortOrder === value} onChange={() => setSortOrder(value)} className="accent-brand-600"/>{label}</label>)}</div></fieldset></FilterPopover>}</div>}
    {showReschedules && pendingReschedules.length > 0 && <Card className="border-sunny-200 bg-sunny-50/50"><h2 className="mb-3 font-extrabold">Reschedule matching ({pendingReschedules.length})</h2><p className="mb-3 text-sm text-slate-600">Review the requested slots and assign the same tutor or another tutor who is available.</p><div className="space-y-3">{pendingReschedules.map((entry) => {
      const proposal = entry.rescheduleProposal;
      const items = proposal.sessions || [proposal];
      const student = s.db.tutees.find((row) => row.userId === entry.tuteeId)?.fullName || entry.tuteeId;
      const availableForAll = items.every((item) => rescheduleOptions(entry, item).length > 0);
      return <div key={entry.id} className="rounded-xl bg-white p-4 text-sm"><div className="font-extrabold">{student} · {entry.subject || entry.program}</div>{items.map((item) => {
        const options = rescheduleOptions(entry, item);
        const key = `${entry.id}:${item.sessionId}`;
        const selected = rescheduleTutorChoice[key] || (options.some((match) => match.tutor.userId === item.tutorId) ? item.tutorId : options[0]?.tutor.userId || "");
        return <div key={item.sessionId} className="mt-3 grid gap-2 sm:grid-cols-[1fr_15rem]"><div><div className="text-slate-700">{fmtDate(item.original.date)} · {fmtTime(item.original.time)} → <b>{fmtDate(item.date)} · {fmtTime(item.time)}</b></div><div className="text-xs text-slate-500">Requested reason: {proposal.reason || "—"}</div></div><Select value={selected} onChange={(event) => setRescheduleTutorChoice((current) => ({ ...current, [key]: event.target.value }))}><option value="">{options.length ? "Choose tutor" : "No tutor available"}</option>{options.map((match) => <option key={match.tutor.userId} value={match.tutor.userId}>{match.tutor.fullName}{match.tutor.userId === item.original.tutorId ? " · current tutor" : ""}</option>)}</Select></div>;
      })}{rescheduleErrors[entry.id] && <Alert kind="error">{rescheduleErrors[entry.id]}</Alert>}<div className="mt-3 flex justify-end gap-2"><Button size="sm" variant="danger" disabled={rescheduleBusy[entry.id]} onClick={() => reviewReschedule(entry, false)}>Reject</Button><Button size="sm" variant="success" disabled={rescheduleBusy[entry.id] || !availableForAll} onClick={() => reviewReschedule(entry, true)}>{rescheduleBusy[entry.id] ? "Saving…" : "Approve matches"}</Button></div></div>;
    })}</div></Card>}
    {!booking ? <>
      {pending.length === 0 ? <Empty>No booking requests waiting for review.</Empty> : <div className="space-y-4">{pending.map((b) => {
        const student = s.db.tutees.find((t) => t.userId === b.tuteeId);
        const grouped = b.program === "reading" ? allPending.filter((entry) => entry.program === "reading" && entry.tuteeId === b.tuteeId && entry.assessmentId === b.assessmentId) : [b];
        const done = s.db.sessions.filter((session) => grouped.some((entry) => entry.id === session.bookingId) && session.status !== "cancelled").length;
        const bookingSlots = b.program === "reading" ? [...new Map(grouped.flatMap((entry) => entry.sessionSlots ?? entry.dates.map((date) => ({ date, subject: "Reading", time: entry.sessionTimes?.[date] ?? entry.time }))).map((slot) => [`${slot.date}|${slot.time}`, slot])).values()] : b.sessionSlots ?? b.dates.map((date) => ({ date, subject: b.sessionSubjects?.[date] ?? b.subject, time: b.sessionTimes?.[date] ?? b.time }));
        if (cardLayout) {
          const subjects = [...new Set(bookingSlots.map((slot) => slot.subject).filter(Boolean))];
          const bookedAt = b.createdAt ? new Date(b.createdAt).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" }) : "—";
          return <article key={b.id} className="rounded-3xl border-0 bg-white p-5 shadow-sm sm:px-7 sm:py-6">
            <header className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-extrabold text-slate-800">{student?.fullName || b.tuteeId} · {student?.gradeLevel || b.gradeLevel}</h2><p className="text-sm font-bold text-slate-600">{subjects.join(" · ") || b.subject} · {bookingSlots.length} sessions · {peso(b.totalFee)} · {b.modality === "face-to-face" ? "Face-to-Face" : "Online"}</p></div><span className="min-w-36 rounded-xl bg-amber-100 px-4 py-2 text-center text-sm font-extrabold text-amber-700">Pending</span></header>
            <div className="mt-6 grid gap-3 sm:grid-cols-2"><Button className="w-full rounded-2xl py-4" onClick={() => setSelectedId(b.id)}>Assign a Tutor</Button><Button className="w-full rounded-2xl py-4" onClick={() => setScheduleModal(b)}>View Requested Schedule</Button></div>
            <p className="mt-4 text-sm text-slate-400">Booked on {bookedAt}</p>
          </article>;
        }
        return <button type="button" key={b.id} onClick={() => setSelectedId(b.id)} className="block w-full text-left"><Card className="transition hover:border-brand-300 hover:shadow-md"><div className="flex flex-wrap items-center justify-between gap-2"><div><div className="font-extrabold">{student?.fullName} <span className="font-normal text-slate-500">· {student?.gradeLevel}</span></div><div className="mt-1 text-sm text-slate-600">{b.program === "academic" ? "Academic" : b.program === "reading" ? "Reading Program assignment" : b.program} · {b.subject} · {bookingSlots.length} session(s) · {peso(b.program === "reading" ? b.ratePerHour * bookingSlots.length : b.totalFee)}</div></div><Badge status={b.status}/></div><div className="mt-2 text-xs text-slate-500">{bookingSlots.map((slot, index) => <span key={`${slot.date}-${slot.time}-${index}`}>{fmtDate(slot.date)} · {slot.subject} · {fmtTime(slot.time)}{index < bookingSlots.length - 1 ? "  /  " : ""}</span>)}</div>{done > 0 && <div className="mt-2 text-xs font-bold text-brand-700">{done}/{bookingSlots.length} sessions assigned</div>}</Card></button>;
      })}</div>}
    </> : <div className="space-y-4">
      {!initialSelectedId && <Button variant="secondary" size="sm" onClick={() => setSelectedId(null)}>← All bookings</Button>}
      <Card className="space-y-5 rounded-3xl border-0 bg-white p-6 shadow-sm sm:p-8"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-xl font-extrabold text-slate-800">{tutee?.fullName}</h2><p className="text-sm text-slate-600">{tutee?.gradeLevel} · {booking.program === "reading" ? "Reading" : booking.program === "academic" ? [...new Set((booking.sessionSlots || []).map((slot) => slot.subject).filter(Boolean))].join(" · ") || booking.subject : booking.subject} · {booking.cycleType === "1-month" ? "4-week cycle" : booking.cycleType ? `${booking.cycleType} cycle` : "schedule"} · {booking.program === "reading" ? readingSlots.length : (booking.sessionSlots?.length ?? booking.dates.length)} sessions · {booking.modality === "face-to-face" ? "Face-to-Face" : "Online"}</p></div><div className="flex gap-2"><Button size="sm" variant="danger" onClick={() => setRej(booking)}>Reject</Button><span className="rounded-full bg-amber-100 px-5 py-2 text-sm font-extrabold text-amber-700">Pending</span></div></div>{booking.program !== "academic" && <><p className="text-sm"><b>Learning needs:</b> {booking.learningNeeds || "—"}</p>{assessment && <p className="text-sm"><b>Assessment:</b> {assessment.readingLevel} — {assessment.results}</p>}</>}
        {proposalPending && <Alert kind="warn">Proposed schedule awaits tutee approval. Matching is paused.</Alert>}
        {booking.program === "reading" && <div className="space-y-3 rounded-2xl border-2 border-slate-300 p-4 sm:p-5"><h3 className="font-extrabold">Reading</h3><p className="text-sm text-slate-600">{readingSlots.map((slot) => `${fmtDate(slot.date)} · ${fmtTime(slot.time)}`).join(" / ")}</p>{readingMatches.length ? <><div className="flex items-center justify-between gap-2"><h4 className="font-extrabold">Top Recommended Tutors</h4><Badge status="approved">{readingMatches.length} Eligible Tutors</Badge></div>{readingMatches.slice(0, 3).map((match, rank) => <div key={match.tutor.userId} className={`rounded-2xl border-2 p-4 ${selectedReadingTutor === match.tutor.userId ? "border-blue-200 bg-blue-50" : "border-slate-300 bg-slate-100"}`}><div className="flex flex-wrap items-center gap-3"><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full font-extrabold text-white ${rank === 0 ? "bg-blue-600" : "bg-slate-400"}`}>{rank === 0 ? 1 : rank + 1}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><b>{match.tutor.fullName}</b><Badge status="approved">{Math.round(match.score)}% Match</Badge></div><button type="button" onClick={() => setProfileTutorId(match.tutor.userId)} className="text-sm text-blue-600 underline">View Profile</button><p className="mt-1 text-sm text-slate-600">{match.tutor.subjects?.join(", ") || "Reading"}</p><p className="mt-1 text-sm text-slate-600">Covers All {readingSlots.length} Requested Sessions</p><p className="text-sm text-slate-500">{match.tutor.bio || "Experienced tutor"}</p><div className="text-lg leading-6 text-amber-400" aria-label={match.rating ? `${match.rating.toFixed(1)} out of 5 stars` : "No ratings yet"}>{match.rating ? "★".repeat(Math.max(1, Math.round(match.rating))) : "No ratings yet"}</div></div><Button size="sm" className="min-w-28 rounded-full" onClick={() => setReadingTutorChoice((current) => ({ ...current, [booking.id]: match.tutor.userId }))}>{selectedReadingTutor === match.tutor.userId ? "Assigned" : "Assign"}</Button></div><details className="mt-4"><summary className="cursor-pointer rounded-lg bg-blue-500 px-3 py-2 text-center text-sm font-bold text-white">Show Compatibility Breakdown</summary><div className="mt-3 space-y-3 text-sm">{[["Subject Expertise", match.subjectScore, 35], ["Availability", match.scheduleScore, 25], ["Grade Level", match.gradeScore, 25], ["Workload", match.workloadScore, 15], ["Matching Score", match.score, 100]].map(([label, value, max]) => <div key={label} className="grid items-center gap-2 sm:grid-cols-[9rem_minmax(8rem,1fr)_8rem]"><span>{label}:</span><div className="h-3 overflow-hidden rounded-full bg-slate-200"><div className={`h-full rounded-full ${label === "Matching Score" ? "bg-green-500" : "bg-blue-500"}`} style={{ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%` }} /></div><span className="text-slate-600">{Number(value).toFixed(value % 1 ? 1 : 0)}% out of {max}%</span></div>)}</div></details></div>)}</> : <p className="text-sm text-slate-500">No eligible tutor currently covers every selected session. The assignment remains ready for matching.</p>}</div>}
        {!proposalPending && individual && booking.program !== "reading" && <div className="space-y-3">{sessions.map((session) => <div key={session.key} className="rounded-2xl border-2 border-slate-400 p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-2"><div><div className="text-lg font-bold text-slate-700">{session.subject}</div><button className="text-sm text-blue-600 underline" onClick={() => setScheduleModal(booking)}>View Requested Schedule</button></div><Badge status="approved">{session.eligibleCount} Eligible Tutors</Badge></div>
          {session.matches.length === 0 ? <p className="mt-3 text-sm text-slate-500">No tutor can cover every occurrence of this weekday yet. It remains pending.</p> : <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between gap-2"><h4 className="font-extrabold">Top Recommended Tutors</h4><Badge status="approved">{session.eligibleCount} Eligible Tutors</Badge></div>
              {session.matches.map((match, rank) => <div key={match.tutor.userId} className={`rounded-2xl border-2 p-4 ${academicTutorChoices[booking.id]?.[session.key] === match.tutor.userId || (!academicTutorChoices[booking.id]?.[session.key] && rank === 0) ? "border-blue-200 bg-blue-50" : "border-slate-300 bg-slate-100"}`}>
                <div className="flex flex-wrap items-center gap-3">
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full font-extrabold text-white ${rank === 0 ? "bg-blue-600" : "bg-slate-400"}`}>{rank === 0 ? 1 : rank + 1}</span>
                  <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><b className="text-base">{match.tutor.fullName}</b>{(academicTutorChoices[booking.id]?.[session.key] === match.tutor.userId || (!academicTutorChoices[booking.id]?.[session.key] && session.assigned?.tutorId === match.tutor.userId)) && <span className="rounded-full bg-blue-200 px-4 py-1 text-xs font-bold text-blue-700">Assigned</span>}<Badge status="approved">{Math.round(match.score)}% Match</Badge></div><button type="button" onClick={() => setProfileTutorId(match.tutor.userId)} className="text-sm text-blue-600 underline">View Profile</button>
                  </div>
                  <Button size="sm" className="min-w-28 rounded-full" disabled={session.assigned?.tutorId === match.tutor.userId} onClick={() => setAcademicTutorChoices((current) => ({ ...current, [booking.id]: { ...(current[booking.id] || {}), [session.key]: match.tutor.userId } }))}>{academicTutorChoices[booking.id]?.[session.key] === match.tutor.userId || session.assigned?.tutorId === match.tutor.userId ? "Assigned" : "Assign"}</Button>
                </div>
                <details className="mt-4"><summary className="cursor-pointer rounded-lg bg-blue-500 px-3 py-2 text-center text-sm font-bold text-white">Show Compatibility Breakdown</summary><div className="mt-3 space-y-3 text-sm">
                  {[["Subject Expertise", match.subjectScore, 35], ["Availability", match.scheduleScore, 25], ["Grade Level", match.gradeScore, 25], ["Workload", match.workloadScore, 15], ["Matching Score", match.score, 100]].map(([label, value, max]) => <div key={label} className="grid items-center gap-2 sm:grid-cols-[9rem_minmax(8rem,1fr)_8rem]"><span>{label}:</span><div className="h-3 overflow-hidden rounded-full bg-slate-200"><div className={`h-full rounded-full ${label === "Matching Score" ? "bg-green-500" : "bg-blue-500"}`} style={{ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%` }} /></div><span className="text-slate-600">{Number(value).toFixed(value % 1 ? 1 : 0)}% out of {max}%</span></div>)}
                </div></details>
              </div>)}
            </div>}
          </div>)}</div>}
        {!proposalPending && !individual && <div className="space-y-2"><h3 className="font-extrabold">Recommended tutors</h3>{matchTutors(s.db, { program: booking.program, subject: booking.subject, gradeLevel: booking.gradeLevel, modality: booking.modality, learningNeeds: booking.learningNeeds, dates: booking.dates, time: booking.time, times: booking.sessionTimes, ignoreBookingId: booking.id }).slice(0, 3).map((match, rank) => <div key={match.tutor.userId} className="flex items-center gap-3 rounded-xl border p-3"><b>{rank + 1}. {match.tutor.fullName}</b><span className="text-sm text-slate-500">{match.coverage}/{match.total} sessions · {Math.round(match.score)}%</span><Button className="ml-auto" size="sm" onClick={() => assignWholeBooking(match.tutor.userId)}>Assign all sessions</Button></div>)}</div>}
        {!proposalPending && individual && <section className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-5"><div><h3 className="text-lg font-extrabold">Confirm Final Assignment</h3>{booking.program === "academic" ? sessions.map((session) => <p key={session.key} className="text-sm font-semibold text-slate-600">{session.subject} Tutor: <span className="text-blue-600">{s.db.tutors.find((tutor) => tutor.userId === (academicTutorChoices[booking.id]?.[session.key] || session.assigned?.tutorId))?.fullName || "Choose a tutor"}</span></p>) : <p className="text-sm font-semibold text-slate-600">Reading Tutor: <span className="text-blue-600">{s.db.tutors.find((tutor) => tutor.userId === selectedReadingTutor)?.fullName || "Choose a tutor"}</span></p>}</div><Button variant="success" className="min-w-36 rounded-full" disabled={assignmentBusy || (booking.program === "reading" ? !selectedReadingTutor : sessions.some((session) => !session.assigned && !(academicTutorChoices[booking.id]?.[session.key])))} onClick={() => void confirmSelectedAssignments()}>{assignmentBusy ? "Saving…" : "Confirm"}</Button></section>}
        {msg[booking.id] && <Alert kind="error">{msg[booking.id]}</Alert>}
        {!individual && <div className="flex flex-wrap justify-end gap-2"><Button size="sm" variant="secondary" disabled={assignments.length > 0} onClick={() => openScheduleEditor(booking)}>{proposalPending ? "Edit proposal" : "Edit schedule"}</Button><Button size="sm" variant="danger" onClick={() => setRej(booking)}>Reject / request rescheduling</Button></div>}
      </Card>
    </div>}
    <Modal open={!!rej} onClose={() => setRej(null)} title="Request rescheduling"><div className="space-y-4"><Field label="Message to parent"><Textarea value={reason} onChange={(e) => setReason(e.target.value)}/></Field><Button variant="danger" onClick={async () => { if (rej.program === "reading") await s.rejectReadingAssignment(rejectedGroup.map((entry) => entry.id), reason); else await s.rejectBooking(rej.id, reason); setRej(null); setSelectedId(null); }}>Release slots & notify</Button></div></Modal>
    <Modal open={!!editing} onClose={() => setEditing(null)} title="Propose schedule change"><div className="space-y-4"><div className="space-y-2">{scheduleDraft.map((session, index) => <div key={index} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2"><Field label={index === 0 ? "Date" : ""}><Input type="date" min={todayISO()} value={session.date} onChange={(e) => setScheduleDraft((current) => current.map((row, i) => i === index ? { ...row, date: e.target.value } : row))}/></Field><Field label={index === 0 ? "Time" : ""}><Select value={session.time} onChange={(e) => setScheduleDraft((current) => current.map((row, i) => i === index ? { ...row, time: e.target.value } : row))}>{HOURS.map((hour) => <option key={hour} value={hour}>{fmtTime(hour)}</option>)}</Select></Field><Button size="sm" variant="danger" onClick={() => setScheduleDraft((current) => current.filter((_, i) => i !== index))}>Remove</Button></div>)}</div><Button variant="secondary" onClick={() => setScheduleDraft((current) => [...current, { date: addDays(current[current.length - 1]?.date || todayISO(), 1), time: current[0]?.time || HOURS[0] }])}>Add session date</Button>{scheduleError && <Alert kind="error">{scheduleError}</Alert>}<Button onClick={async () => { const result = await s.proposeBookingSchedule(editing.id, scheduleDraft); if (!result.ok) return setScheduleError(result.error); setEditing(null); }}>Send for tutee approval</Button></div></Modal>
    <Modal open={!!scheduleModal} onClose={() => setScheduleModal(null)} title="Requested Academic Schedule">
      {scheduleModal && <div className="space-y-2">{(scheduleModal.sessionSlots || scheduleModal.dates.map((date) => ({ date, subject: scheduleModal.sessionSubjects?.[date] || scheduleModal.subject, time: scheduleModal.sessionTimes?.[date] || scheduleModal.time }))).map((slot, index) => <div key={`${slot.date}-${slot.time}-${index}`} className="grid grid-cols-[1fr_1fr_1fr] rounded-xl bg-slate-50 p-3 text-sm font-semibold"><span>{fmtDate(slot.date)}</span><span>{slot.subject || scheduleModal.subject}</span><span className="text-right">{fmtTime(slot.time)}</span></div>)}</div>}
    </Modal>
    <ProfileModal open={!!profileTutor} onClose={() => setProfileTutorId(null)} title={profileTutor?.fullName || "Tutor Profile"}>
      {profileTutor && <div className="space-y-3"><div className="grid grid-cols-2 gap-2"><div><b>Email:</b> {profileTutorEmail || "—"}</div><div><b>Status:</b> <Badge status={profileTutor.status}/></div><div><b>Age:</b> {profileTutor.age ?? "—"}</div><div><b>Contact:</b> {profileTutor.contact || "—"}</div><div className="col-span-2"><b>Subjects:</b> {profileTutor.subjects?.join(", ") || "—"}</div><div className="col-span-2"><b>Grade bands:</b> {profileTutor.gradeBands?.join(", ") || "—"}</div></div><div><b>Assigned students:</b> {profileTutorStudents.join(", ") || "None"}</div><div className="border-t border-slate-100 pt-3"><b>Resume:</b>{profileTutor.resumeData ? <button type="button" onClick={() => openPdfDataUrl(profileTutor.resumeData)} className="ml-2 font-bold text-brand-600 underline hover:text-brand-700">View {profileTutor.resumeName || "resume PDF"}</button> : <span className="ml-2 text-slate-500">No resume uploaded</span>}</div></div>}
    </ProfileModal>
  </>;
}
