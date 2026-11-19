"use client";
import { useMemo, useState } from "react";
import { Alert, Badge, Button, Card, Empty, Field, Input, Modal, PageHeader, Select, Textarea, peso } from "@/components/ui";
import { addDays, fmtDate, fmtTime, todayISO } from "@/lib/dates";
import { HOURS } from "@/lib/constants";
import { matchTutors } from "@/lib/logic";
import { useStore } from "@/lib/store";

function sessionEndTime(time) {
  const [hour, minute] = time.split(":").map(Number);
  const end = new Date(2000, 0, 1, hour, minute + 45);
  return `${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`;
}
const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function Matching({ embedded = false, programFilter = null } = {}) {
  const s = useStore();
  const [msg, setMsg] = useState({});
  const [selectedId, setSelectedId] = useState(null);
  const [rej, setRej] = useState(null);
  const [reason, setReason] = useState("The requested schedule is not available.");
  const [editing, setEditing] = useState(null);
  const [scheduleDraft, setScheduleDraft] = useState([]);
  const [scheduleError, setScheduleError] = useState("");
  const [readingTutorChoice, setReadingTutorChoice] = useState({});
  const [rescheduleTutorChoice, setRescheduleTutorChoice] = useState({});
  const [rescheduleErrors, setRescheduleErrors] = useState({});
  const [rescheduleBusy, setRescheduleBusy] = useState({});
  const allPending = s.db.bookings.filter((b) => (!programFilter || b.program === programFilter) && ["awaiting_admin", "ready_for_matching"].includes(b.status)
    && (b.program !== "reading" || s.db.assessments.some((a) => a.id === b.assessmentId && a.tuteeId === b.tuteeId && a.status === "completed")));
  const pending = allPending.filter((booking, index) => booking.program !== "reading" || allPending.findIndex((other) => other.program === "reading" && other.tuteeId === booking.tuteeId && other.assessmentId === booking.assessmentId) === index);
  const booking = pending.find((b) => b.id === selectedId);
  const bookingGroup = booking?.program === "reading" ? allPending.filter((entry) => entry.program === "reading" && entry.tuteeId === booking.tuteeId && entry.assessmentId === booking.assessmentId) : booking ? [booking] : [];
  const rejectedGroup = rej?.program === "reading" ? allPending.filter((entry) => entry.program === "reading" && entry.tuteeId === rej.tuteeId && entry.assessmentId === rej.assessmentId) : [];
  const readingSlotMap = new Map();
  bookingGroup.forEach((entry) => (entry.sessionSlots ?? entry.dates.map((date) => ({ date, time: entry.sessionTimes?.[date] ?? entry.time, subject: "Reading" }))).forEach((slot) => readingSlotMap.set(`${slot.date}|${slot.time}`, { ...slot, subject: "Reading" })));
  const readingSlots = [...readingSlotMap.values()].sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  const tutee = booking && s.db.tutees.find((t) => t.userId === booking.tuteeId);
  const assessment = booking?.assessmentId ? s.db.assessments.find((a) => a.id === booking.assessmentId) : undefined;
  const proposalPending = !!booking?.scheduleProposal;
  const individual = booking?.program === "academic" || booking?.program === "reading";
  const assignments = useMemo(() => booking ? s.db.sessions.filter((session) => session.bookingId === booking.id && session.status !== "cancelled") : [], [booking, s.db.sessions]);
  const sessions = useMemo(() => {
    if (!booking || !individual || proposalPending) return [];
    const groups = new Map();
    const requestedSlots = booking.sessionSlots ?? booking.dates.map((date) => ({ seriesKey: `day-${new Date(`${date}T00:00:00Z`).getUTCDay()}`, day: new Date(`${date}T00:00:00Z`).getUTCDay(), date, subject: booking.sessionSubjects?.[date] ?? booking.subject, time: booking.sessionTimes?.[date] ?? booking.time }));
    for (const slot of requestedSlots) {
      const key = slot.seriesKey;
      if (!groups.has(key)) groups.set(key, { key, day: slot.day, subject: slot.subject, time: slot.time, slots: [] });
      groups.get(key).slots.push(slot);
    }
    return [...groups.values()].sort((a, b) => a.slots[0].date.localeCompare(b.slots[0].date) || a.time.localeCompare(b.time)).map((group) => {
      const assignedSessions = group.slots.map((slot) => assignments.find((session) => session.date === slot.date && session.time === slot.time)).filter(Boolean);
      const assigned = assignedSessions.length === group.slots.length && new Set(assignedSessions.map((session) => session.tutorId)).size === 1 ? assignedSessions[0] : null;
      const ranked = assigned || assignedSessions.length ? [] : matchTutors(s.db, {
        program: booking.program, subject: group.subject, gradeLevel: booking.gradeLevel, modality: booking.modality, learningNeeds: booking.learningNeeds,
        sessionType: booking.sessionType ?? "one-on-one", dates: group.slots.map((slot) => slot.date), time: group.time,
        times: Object.fromEntries(group.slots.map((slot) => [slot.date, group.time])), ignoreBookingId: booking.id,
      }).filter((match) => match.full);
      return { ...group, dates: group.slots.map((slot) => slot.date), assigned, eligibleCount: ranked.length, matches: ranked.slice(0, 3) };
    });
  }, [booking, individual, proposalPending, assignments, s.db]);
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
  const chosenReadingTutor = readingTutorChoice[booking?.id] ?? suggestedTutorId;
  const pendingReschedules = s.db.bookings.filter((entry) => (!programFilter || entry.program === programFilter) && entry.rescheduleProposal);
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
    {pendingReschedules.length > 0 && <Card className="border-sunny-200 bg-sunny-50/50"><h2 className="mb-3 font-extrabold">Reschedule matching ({pendingReschedules.length})</h2><p className="mb-3 text-sm text-slate-600">Review the requested slots and assign the same tutor or another tutor who is available.</p><div className="space-y-3">{pendingReschedules.map((entry) => {
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
      {pending.length === 0 ? <Empty>No booking requests waiting for review.</Empty> : <div className="space-y-3">{pending.map((b) => {
        const student = s.db.tutees.find((t) => t.userId === b.tuteeId);
        const grouped = b.program === "reading" ? allPending.filter((entry) => entry.program === "reading" && entry.tuteeId === b.tuteeId && entry.assessmentId === b.assessmentId) : [b];
        const done = s.db.sessions.filter((session) => grouped.some((entry) => entry.id === session.bookingId) && session.status !== "cancelled").length;
        const bookingSlots = b.program === "reading" ? [...new Map(grouped.flatMap((entry) => entry.sessionSlots ?? entry.dates.map((date) => ({ date, subject: "Reading", time: entry.sessionTimes?.[date] ?? entry.time }))).map((slot) => [`${slot.date}|${slot.time}`, slot])).values()] : b.sessionSlots ?? b.dates.map((date) => ({ date, subject: b.sessionSubjects?.[date] ?? b.subject, time: b.sessionTimes?.[date] ?? b.time }));
        return <button type="button" key={b.id} onClick={() => setSelectedId(b.id)} className="block w-full text-left"><Card className="transition hover:border-brand-300 hover:shadow-md"><div className="flex flex-wrap items-center justify-between gap-2"><div><div className="font-extrabold">{student?.fullName} <span className="font-normal text-slate-500">· {student?.gradeLevel}</span></div><div className="mt-1 text-sm text-slate-600">{b.program === "academic" ? "Academic" : b.program === "reading" ? "Reading Program assignment" : b.program} · {b.subject} · {bookingSlots.length} session(s) · {peso(b.program === "reading" ? b.ratePerHour * bookingSlots.length : b.totalFee)}</div></div><Badge status={b.status}/></div><div className="mt-2 text-xs text-slate-500">{bookingSlots.map((slot, index) => <span key={`${slot.date}-${slot.time}-${index}`}>{fmtDate(slot.date)} · {slot.subject} · {fmtTime(slot.time)}{index < bookingSlots.length - 1 ? "  /  " : ""}</span>)}</div>{done > 0 && <div className="mt-2 text-xs font-bold text-brand-700">{done}/{bookingSlots.length} sessions assigned</div>}</Card></button>;
      })}</div>}
    </> : <div className="space-y-4">
      <Button variant="secondary" size="sm" onClick={() => setSelectedId(null)}>← All bookings</Button>
      <Card className="space-y-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><h2 className="text-lg font-extrabold">{tutee?.fullName} <span className="text-sm font-normal text-slate-500">· {tutee?.gradeLevel}</span></h2><p className="text-sm text-slate-600">{booking.program === "reading" ? "Reading Program assignment" : booking.subject} · {booking.cycleType === "1-month" ? "4-week cycle" : booking.cycleType ? `${booking.cycleType} cycle` : "schedule"} · {booking.program === "reading" ? readingSlots.length : (booking.sessionSlots?.length ?? booking.dates.length)} session(s) · <Badge status={booking.modality}/> · {peso(booking.ratePerHour)}/{booking.program === "academic" || booking.program === "reading" ? "session" : "h"} · Total {peso(booking.program === "reading" ? booking.ratePerHour * readingSlots.length : booking.totalFee)}</p></div><Badge status={booking.status}/></div><p className="text-sm"><b>Learning needs:</b> {booking.learningNeeds || "—"}</p>{assessment && <p className="text-sm"><b>Assessment:</b> {assessment.readingLevel} — {assessment.results}</p>}
        {proposalPending && <Alert kind="warn">Proposed schedule awaits tutee approval. Matching is paused.</Alert>}
        {booking.program === "reading" && <div className="space-y-3"><h3 className="font-extrabold">One tutor assignment for all Reading sessions</h3><p className="text-sm text-slate-600">{readingSlots.map((slot) => `${fmtDate(slot.date)} · ${fmtTime(slot.time)}`).join(" / ")}</p>{readingMatches.length ? <><div className="flex items-center justify-between gap-2"><h4 className="font-extrabold">Top Recommended Tutors</h4><Badge status="approved">{readingMatches.length} Eligible Tutors</Badge></div>{readingMatches.slice(0, 3).map((match, rank) => <div key={match.tutor.userId} className={`rounded-xl border-2 p-4 ${rank === 0 ? "border-blue-200 bg-blue-50/20" : "border-slate-200 bg-white"}`}><div className="flex flex-wrap items-center gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-blue-100 font-extrabold text-blue-600">{rank + 1}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><b>{match.tutor.fullName}</b><span className="text-sm text-slate-500">· {match.tutor.gradeBands?.join(", ") || "Grade bands not listed"} · {booking.modality === "face-to-face" ? "Face-to-Face" : "Online"}</span><Badge status={match.score >= 80 ? "approved" : "pending"}>{Math.round(match.score)}% match</Badge>{match.tutor.userId === suggestedTutorId && <Badge status="approved">Suggested</Badge>}</div><p className="mt-1 text-sm text-slate-600">{match.tutor.subjects?.join(", ") || "Reading"}</p><p className="mt-1 text-sm text-slate-600">Covers All {readingSlots.length} Requested Sessions</p><p className="text-sm text-slate-500">{match.tutor.bio || "Experienced tutor"}</p><div className="text-lg leading-6 text-amber-400" aria-label={match.rating ? `${match.rating.toFixed(1)} out of 5 stars` : "No ratings yet"}>{match.rating ? "★".repeat(Math.max(1, Math.round(match.rating))) : "No ratings yet"}</div></div><Button size="sm" variant="success" onClick={() => { setReadingTutorChoice((current) => ({ ...current, [booking.id]: match.tutor.userId })); void assignWholeBooking(match.tutor.userId); }}>Confirm Assignment</Button></div><details className="mt-4 pl-12"><summary className="cursor-pointer font-bold">Compatibility Breakdown</summary><div className="mt-3 space-y-3 text-sm">{[["Subject Expertise", match.subjectScore, 40], ["Availability", match.scheduleScore, 35], ["Grade Level", match.gradeScore, 25], ["Matching Score", match.score, 100]].map(([label, value, max]) => <div key={label} className="grid items-center gap-2 sm:grid-cols-[9rem_minmax(8rem,1fr)_8rem]"><span>{label}:</span><div className="h-3 overflow-hidden rounded-full bg-slate-200"><div className={`h-full rounded-full ${label === "Matching Score" ? "bg-green-500" : "bg-blue-500"}`} style={{ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%` }} /></div><span className="text-slate-600">{Number(value).toFixed(value % 1 ? 1 : 0)}% out of {max}%</span></div>)}</div></details></div>)}<div className="flex justify-end"><Button disabled={!chosenReadingTutor} onClick={() => assignWholeBooking(chosenReadingTutor)}>Confirm one tutor assignment</Button></div></> : <p className="text-sm text-slate-500">No eligible tutor currently covers every selected session. The assignment remains ready for matching.</p>}</div>}
        {!proposalPending && individual && booking.program !== "reading" && <div className="space-y-3"><h3 className="font-extrabold">Matching by selected weekday</h3>{sessions.map((session) => <div key={session.key} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><div className="font-extrabold">{WEEKDAY_NAMES[session.day]} — {session.subject}</div><div className="text-xs text-slate-500">{session.dates.map(fmtDate).join(" · ")} · {fmtTime(session.time)}–{fmtTime(sessionEndTime(session.time))}</div></div>{session.assigned ? <Badge status={session.assigned.status === "scheduled" ? "confirmed" : session.assigned.status}>{s.db.tutors.find((tutor) => tutor.userId === session.assigned.tutorId)?.fullName || "Assigned"}</Badge> : <Badge status={session.eligibleCount ? "approved" : "pending"}>{session.eligibleCount} eligible tutors</Badge>}</div>
            {session.assigned ? <p className="mt-2 text-sm">Same tutor assigned across all {session.slots.length} sessions in this weekly slot.</p> : session.matches.length === 0 ? <p className="mt-3 text-sm text-slate-500">No tutor can cover every occurrence of this weekday yet. It remains pending.</p> : <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between gap-2"><h4 className="font-extrabold">Top Recommended Tutors</h4><Badge status="approved">{session.eligibleCount} Eligible Tutors</Badge></div>
              {session.matches.map((match, rank) => <div key={match.tutor.userId} className={`rounded-xl border-2 p-4 ${rank === 0 ? "border-blue-200 bg-blue-50/20" : "border-slate-200 bg-white"}`}>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-blue-100 font-extrabold text-blue-600">{rank + 1}</span>
                  <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><b>{match.tutor.fullName}</b><span className="text-sm text-slate-500">· {match.tutor.gradeBands?.join(", ") || "Grade bands not listed"} · {booking.modality === "face-to-face" ? "Face-to-Face" : "Online"}</span><Badge status={match.score >= 80 ? "approved" : "pending"}>{Math.round(match.score)}% match</Badge></div>
                    <p className="mt-1 text-sm text-slate-600">{match.tutor.subjects?.join(", ") || "No subjects listed"}</p>
                    <p className="mt-1 text-sm text-slate-600">{match.full ? "Covers All Requested Schedule" : `${match.coverage} of ${match.total} requested sessions covered`}</p>
                    <p className="text-sm text-slate-500">{match.tutor.bio || "Experienced tutor"}</p>
                    <div className="text-lg leading-6 text-amber-400" aria-label={match.rating ? `${match.rating.toFixed(1)} out of 5 stars` : "No ratings yet"}>{match.rating ? "★".repeat(Math.max(1, Math.round(match.rating))) : "No ratings yet"}</div>
                  </div>
                  <Button size="sm" variant="success" onClick={() => assignSession(session.slots, match.tutor.userId)}>Confirm Assignment</Button>
                </div>
                <details className="mt-4 pl-12"><summary className="cursor-pointer font-bold">Compatibility Breakdown</summary><div className="mt-3 space-y-3 text-sm">
                  {[["Subject Expertise", match.subjectScore, 40], ["Availability", match.scheduleScore, 35], ["Grade Level", match.gradeScore, 25], ["Matching Score", match.score, 100]].map(([label, value, max]) => <div key={label} className="grid items-center gap-2 sm:grid-cols-[9rem_minmax(8rem,1fr)_8rem]"><span>{label}:</span><div className="h-3 overflow-hidden rounded-full bg-slate-200"><div className={`h-full rounded-full ${label === "Matching Score" ? "bg-green-500" : "bg-blue-500"}`} style={{ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%` }} /></div><span className="text-slate-600">{Number(value).toFixed(value % 1 ? 1 : 0)}% out of {max}%</span></div>)}
                </div></details>
              </div>)}
            </div>}
          </div>)}</div>}
        {!proposalPending && !individual && <div className="space-y-2"><h3 className="font-extrabold">Recommended tutors</h3>{matchTutors(s.db, { program: booking.program, subject: booking.subject, gradeLevel: booking.gradeLevel, modality: booking.modality, learningNeeds: booking.learningNeeds, dates: booking.dates, time: booking.time, times: booking.sessionTimes, ignoreBookingId: booking.id }).slice(0, 3).map((match, rank) => <div key={match.tutor.userId} className="flex items-center gap-3 rounded-xl border p-3"><b>{rank + 1}. {match.tutor.fullName}</b><span className="text-sm text-slate-500">{match.coverage}/{match.total} sessions · {Math.round(match.score)}%</span><Button className="ml-auto" size="sm" onClick={() => assignWholeBooking(match.tutor.userId)}>Assign all sessions</Button></div>)}</div>}
        {msg[booking.id] && <Alert kind="error">{msg[booking.id]}</Alert>}
        <div className="flex flex-wrap justify-end gap-2">{!individual && <Button size="sm" variant="secondary" disabled={assignments.length > 0} onClick={() => openScheduleEditor(booking)}>{proposalPending ? "Edit proposal" : "Edit schedule"}</Button>}<Button size="sm" variant="danger" onClick={() => setRej(booking)}>Reject / request rescheduling</Button></div>
      </Card>
    </div>}
    <Modal open={!!rej} onClose={() => setRej(null)} title="Request rescheduling"><div className="space-y-4"><Field label="Message to parent"><Textarea value={reason} onChange={(e) => setReason(e.target.value)}/></Field><Button variant="danger" onClick={async () => { if (rej.program === "reading") await s.rejectReadingAssignment(rejectedGroup.map((entry) => entry.id), reason); else await s.rejectBooking(rej.id, reason); setRej(null); setSelectedId(null); }}>Release slots & notify</Button></div></Modal>
    <Modal open={!!editing} onClose={() => setEditing(null)} title="Propose schedule change"><div className="space-y-4"><div className="space-y-2">{scheduleDraft.map((session, index) => <div key={index} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2"><Field label={index === 0 ? "Date" : ""}><Input type="date" min={todayISO()} value={session.date} onChange={(e) => setScheduleDraft((current) => current.map((row, i) => i === index ? { ...row, date: e.target.value } : row))}/></Field><Field label={index === 0 ? "Time" : ""}><Select value={session.time} onChange={(e) => setScheduleDraft((current) => current.map((row, i) => i === index ? { ...row, time: e.target.value } : row))}>{HOURS.map((hour) => <option key={hour} value={hour}>{fmtTime(hour)}</option>)}</Select></Field><Button size="sm" variant="danger" onClick={() => setScheduleDraft((current) => current.filter((_, i) => i !== index))}>Remove</Button></div>)}</div><Button variant="secondary" onClick={() => setScheduleDraft((current) => [...current, { date: addDays(current[current.length - 1]?.date || todayISO(), 1), time: current[0]?.time || HOURS[0] }])}>Add session date</Button>{scheduleError && <Alert kind="error">{scheduleError}</Alert>}<Button onClick={async () => { const result = await s.proposeBookingSchedule(editing.id, scheduleDraft); if (!result.ok) return setScheduleError(result.error); setEditing(null); }}>Send for tutee approval</Button></div></Modal>
  </>;
}
