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

export default function Matching() {
  const s = useStore();
  const [msg, setMsg] = useState({});
  const [selectedId, setSelectedId] = useState(null);
  const [rej, setRej] = useState(null);
  const [reason, setReason] = useState("The requested schedule is not available.");
  const [editing, setEditing] = useState(null);
  const [scheduleDraft, setScheduleDraft] = useState([]);
  const [scheduleError, setScheduleError] = useState("");
  const pending = s.db.bookings.filter((b) => b.status === "awaiting_admin");
  const booking = pending.find((b) => b.id === selectedId);
  const tutee = booking && s.db.tutees.find((t) => t.userId === booking.tuteeId);
  const assessment = booking?.assessmentId ? s.db.assessments.find((a) => a.id === booking.assessmentId) : undefined;
  const proposalPending = !!booking?.scheduleProposal;
  const individual = booking?.program === "academic";
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
  const assignWholeBooking = async (tutorId) => showError(booking.id, await s.confirmBooking(booking.id, tutorId));

  return <>
    <PageHeader title="Tutor–tutee matching" subtitle="Review each booking, then assign tutors to its sessions."/>
    {!booking ? <>
      {pending.length === 0 ? <Empty>No booking requests waiting for review.</Empty> : <div className="space-y-3">{pending.map((b) => {
        const student = s.db.tutees.find((t) => t.userId === b.tuteeId);
        const done = s.db.sessions.filter((session) => session.bookingId === b.id && session.status !== "cancelled").length;
        const bookingSlots = b.sessionSlots ?? b.dates.map((date) => ({ date, subject: b.sessionSubjects?.[date] ?? b.subject, time: b.sessionTimes?.[date] ?? b.time }));
        return <button type="button" key={b.id} onClick={() => setSelectedId(b.id)} className="block w-full text-left"><Card className="transition hover:border-brand-300 hover:shadow-md"><div className="flex flex-wrap items-center justify-between gap-2"><div><div className="font-extrabold">{student?.fullName} <span className="font-normal text-slate-500">· {student?.gradeLevel}</span></div><div className="mt-1 text-sm text-slate-600">{b.program === "academic" ? "Academic" : b.program} · {b.subject} · {bookingSlots.length} session(s) · {peso(b.totalFee)}</div></div><Badge status={b.status}/></div><div className="mt-2 text-xs text-slate-500">{bookingSlots.map((slot, index) => <span key={`${slot.date}-${slot.time}-${index}`}>{fmtDate(slot.date)} · {slot.subject} · {fmtTime(slot.time)}{index < bookingSlots.length - 1 ? "  /  " : ""}</span>)}</div>{done > 0 && <div className="mt-2 text-xs font-bold text-brand-700">{done}/{bookingSlots.length} sessions assigned</div>}</Card></button>;
      })}</div>}
    </> : <div className="space-y-4">
      <Button variant="secondary" size="sm" onClick={() => setSelectedId(null)}>← All bookings</Button>
      <Card className="space-y-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><h2 className="text-lg font-extrabold">{tutee?.fullName} <span className="text-sm font-normal text-slate-500">· {tutee?.gradeLevel}</span></h2><p className="text-sm text-slate-600">{booking.subject} · {booking.cycleType === "1-month" ? "4-week cycle" : booking.cycleType ? `${booking.cycleType} cycle` : "schedule"} · {(booking.sessionSlots?.length ?? booking.dates.length)} session(s) · <Badge status={booking.modality}/> · {peso(booking.ratePerHour)}/{booking.program === "academic" ? "session" : "h"} · Total {peso(booking.totalFee)}</p></div><Badge status={booking.status}/></div><p className="text-sm"><b>Learning needs:</b> {booking.learningNeeds || "—"}</p>{assessment && <p className="text-sm"><b>Assessment:</b> {assessment.readingLevel} — {assessment.results}</p>}
        {proposalPending && <Alert kind="warn">Proposed schedule awaits tutee approval. Matching is paused.</Alert>}
        {!proposalPending && individual && <div className="space-y-3"><h3 className="font-extrabold">Matching by selected weekday</h3>{sessions.map((session) => <div key={session.key} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><div className="font-extrabold">{WEEKDAY_NAMES[session.day]} — {session.subject}</div><div className="text-xs text-slate-500">{session.dates.map(fmtDate).join(" · ")} · {fmtTime(session.time)}–{fmtTime(sessionEndTime(session.time))}</div></div>{session.assigned ? <Badge status={session.assigned.status === "scheduled" ? "confirmed" : session.assigned.status}>{s.db.tutors.find((tutor) => tutor.userId === session.assigned.tutorId)?.fullName || "Assigned"}</Badge> : <Badge status={session.eligibleCount ? "approved" : "pending"}>{session.eligibleCount} eligible tutors</Badge>}</div>
            {session.assigned ? <p className="mt-2 text-sm">Same tutor assigned across all {session.slots.length} sessions in this weekly slot.</p> : session.matches.length === 0 ? <p className="mt-3 text-sm text-slate-500">No tutor can cover every occurrence of this weekday yet. It remains pending.</p> : <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[480px] text-left text-sm"><thead><tr className="border-b text-xs text-slate-500"><th className="py-2">Rank</th><th>Tutor</th><th>Compatibility</th><th></th></tr></thead><tbody>{session.matches.map((match, rank) => <tr key={match.tutor.userId} className="border-b last:border-0"><td className="py-2">{rank + 1}</td><td><div className="font-bold">{match.tutor.fullName}</div><div className="text-xs text-slate-500">{match.tutor.subjects.join(", ")}</div></td><td>{Math.round(match.score)}%</td><td className="text-right"><Button size="sm" onClick={() => assignSession(session.slots, match.tutor.userId)}>Assign all {session.slots.length}</Button></td></tr>)}</tbody></table></div>}
          </div>)}</div>}
        {!proposalPending && !individual && <div className="space-y-2"><h3 className="font-extrabold">Recommended tutors</h3>{matchTutors(s.db, { program: booking.program, subject: booking.subject, gradeLevel: booking.gradeLevel, modality: booking.modality, learningNeeds: booking.learningNeeds, dates: booking.dates, time: booking.time, times: booking.sessionTimes, ignoreBookingId: booking.id }).slice(0, 3).map((match, rank) => <div key={match.tutor.userId} className="flex items-center gap-3 rounded-xl border p-3"><b>{rank + 1}. {match.tutor.fullName}</b><span className="text-sm text-slate-500">{match.coverage}/{match.total} sessions · {Math.round(match.score)}%</span><Button className="ml-auto" size="sm" onClick={() => assignWholeBooking(match.tutor.userId)}>Assign all sessions</Button></div>)}</div>}
        {msg[booking.id] && <Alert kind="error">{msg[booking.id]}</Alert>}
        <div className="flex flex-wrap justify-end gap-2">{!individual && <Button size="sm" variant="secondary" disabled={assignments.length > 0} onClick={() => openScheduleEditor(booking)}>{proposalPending ? "Edit proposal" : "Edit schedule"}</Button>}<Button size="sm" variant="danger" onClick={() => setRej(booking)}>Reject / request rescheduling</Button></div>
      </Card>
    </div>}
    <Modal open={!!rej} onClose={() => setRej(null)} title="Request rescheduling"><div className="space-y-4"><Field label="Message to parent"><Textarea value={reason} onChange={(e) => setReason(e.target.value)}/></Field><Button variant="danger" onClick={() => { s.rejectBooking(rej.id, reason); setRej(null); setSelectedId(null); }}>Release slots & notify</Button></div></Modal>
    <Modal open={!!editing} onClose={() => setEditing(null)} title="Propose schedule change"><div className="space-y-4"><p className="text-sm text-slate-500">The tutee must approve these dates and times before tutor matching resumes.</p><div className="space-y-2">{scheduleDraft.map((session, index) => <div key={index} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2"><Field label={index === 0 ? "Date" : ""}><Input type="date" min={todayISO()} value={session.date} onChange={(e) => setScheduleDraft((current) => current.map((row, i) => i === index ? { ...row, date: e.target.value } : row))}/></Field><Field label={index === 0 ? "Time" : ""}><Select value={session.time} onChange={(e) => setScheduleDraft((current) => current.map((row, i) => i === index ? { ...row, time: e.target.value } : row))}>{HOURS.map((hour) => <option key={hour} value={hour}>{fmtTime(hour)}</option>)}</Select></Field><Button size="sm" variant="danger" onClick={() => setScheduleDraft((current) => current.filter((_, i) => i !== index))}>Remove</Button></div>)}</div><Button variant="secondary" onClick={() => setScheduleDraft((current) => [...current, { date: addDays(current[current.length - 1]?.date || todayISO(), 1), time: current[0]?.time || HOURS[0] }])}>Add session date</Button>{scheduleError && <Alert kind="error">{scheduleError}</Alert>}<Button onClick={async () => { const result = await s.proposeBookingSchedule(editing.id, scheduleDraft); if (!result.ok) return setScheduleError(result.error); setEditing(null); }}>Send for tutee approval</Button></div></Modal>
  </>;
}
