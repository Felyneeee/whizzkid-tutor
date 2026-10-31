"use client";
import { useState } from "react";
import { Alert, Badge, Button, Card, Empty, Field, Input, Modal, PageHeader, Select, Textarea, peso } from "@/components/ui";
import { addDays, fmtDate, fmtTime, todayISO } from "@/lib/dates";
import { HOURS } from "@/lib/constants";
import { matchTutors } from "@/lib/logic";
import { useStore } from "@/lib/store";
export default function Matching() {
    const s = useStore();
    const [msg, setMsg] = useState({});
    const [pick, setPick] = useState({});
    const [rej, setRej] = useState(null);
    const [reason, setReason] = useState("The requested schedule is not available.");
    const [editing, setEditing] = useState(null);
    const [scheduleDraft, setScheduleDraft] = useState([]);
    const [scheduleError, setScheduleError] = useState("");
    const pending = s.db.bookings.filter((b) => b.status === "awaiting_admin");
    const openScheduleEditor = (booking) => {
        setEditing(booking);
        setScheduleError("");
        setScheduleDraft(booking.scheduleProposal?.sessions ?? booking.dates.map((date) => ({ date, time: booking.sessionTimes?.[date] ?? booking.time })));
    };
    return (<>
      <PageHeader title="Tutor–tutee matching" subtitle="Review system recommendations and confirm assignments. Only admin-approved availability is considered."/>
      {pending.length === 0 && <Empty>No booking requests waiting for review.</Empty>}
      <div className="space-y-5">
        {pending.map((b) => {
            const tutee = s.db.tutees.find((t) => t.userId === b.tuteeId);
            const assess = b.assessmentId ? s.db.assessments.find((a) => a.id === b.assessmentId) : undefined;
            const proposalPending = !!b.scheduleProposal;
            const matches = proposalPending ? [] : matchTutors(s.db, {
                program: b.program,
                subject: b.subject,
                gradeLevel: b.gradeLevel,
                modality: b.modality,
                dates: b.dates,
                time: b.time,
                times: b.sessionTimes,
                ignoreBookingId: b.id,
            });
            const assignTutor = async (tutorId) => {
                const selected = matches.find((match) => match.tutor.userId === tutorId);
                if (!selected)
                    return;
                if (!selected.full && !confirm(`${selected.tutor.fullName} can only cover ${selected.coverage} of ${selected.total} dates. Confirm anyway? Uncovered dates will be removed from the booking.`))
                    return;
                const result = await s.confirmBooking(b.id, selected.tutor.userId, !selected.full);
                setMsg((current) => ({ ...current, [b.id]: result.ok ? "" : result.error }));
            };
            return (<Card key={b.id} className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="text-lg font-extrabold">
                    {tutee?.fullName} <span className="text-sm font-normal text-slate-500">· {tutee?.gradeLevel}</span>
                  </div>
                  <div className="text-sm text-slate-600">
                    {b.subject} · {b.bookingType} · {b.dates.length} session(s) · <Badge status={b.modality}/> · {peso(b.ratePerHour)}/h (total {peso(b.totalFee)})
                  </div>
                  <div className="text-xs text-slate-500">
                    {b.dates.map((date) => `${fmtDate(date)} at ${fmtTime(b.sessionTimes?.[date] ?? b.time)}`).join(" · ")}
                  </div>
                </div>
                <Badge status={b.status}/>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 text-sm">
                <b>Learning needs:</b> {b.learningNeeds || "—"}
                {assess && (<div className="mt-1">
                    <b>Assessment:</b> {assess.readingLevel} — {assess.results}
                  </div>)}
              </div>
              {b.bookingType === "recurring" && <p className="text-xs text-slate-500">Recurring: prefer the same tutor for the whole period; reassign only when necessary.</p>}
              {proposalPending && (<Alert kind="warn">
                  Proposed schedule awaiting tutee approval. Matching and assignment are paused until the tutee responds.
                  <div className="mt-1 text-xs">{b.scheduleProposal.sessions.map((session) => `${fmtDate(session.date)} at ${fmtTime(session.time)}`).join(" · ")}</div>
                </Alert>)}
              <div>
                <div className="mb-2 text-sm font-extrabold">Recommended tutors</div>
                {proposalPending ? (<Alert kind="warn">Tutor recommendations will be recalculated after the tutee approves the proposed schedule.</Alert>) : matches.length === 0 ? (<Alert kind="warn">No tutor matches this open slot yet. Keep the request pending; recommendations will update when an eligible tutor has approved availability. You can reject it if rescheduling is needed.</Alert>) : (<div className="space-y-2">
                    {matches.slice(0, 3).map((m, i) => (<div key={m.tutor.userId} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-100 p-3">
                        <div className="grid h-8 w-8 place-items-center rounded-full bg-brand-100 text-sm font-extrabold text-brand-700">{i + 1}</div>
                        <div className="min-w-[160px] flex-1">
                          <div className="font-bold">{m.tutor.fullName}</div>
                          <div className="text-xs text-slate-500">{m.tutor.subjects.join(", ")} · {peso(m.tutor.hourlyRate)}/h pay</div>
                        </div>
                        <Badge status={m.full ? "approved" : "pending"}>{m.full ? "covers all dates" : `${m.coverage}/${m.total} dates`}</Badge>
                        <Button size="sm" variant={m.full ? "success" : "secondary"} onClick={() => assignTutor(m.tutor.userId)}>
                          Confirm assignment
                        </Button>
                      </div>))}
                  </div>)}
                {!proposalPending && (<div className="mt-3 flex flex-wrap items-end gap-2 rounded-xl border border-slate-100 p-3">
                    <div className="min-w-[240px] flex-1">
                      <Field label="Or assign a different eligible tutor">
                        <Select disabled={matches.length <= 1} value={pick[b.id] || ""} onChange={(e) => setPick((current) => ({ ...current, [b.id]: e.target.value }))}>
                          <option value="">{matches.length > 1 ? "Choose another tutor…" : "No other tutor currently matches this schedule"}</option>
                          {matches.slice(1).map((m) => (<option key={m.tutor.userId} value={m.tutor.userId}>
                              {m.tutor.fullName} · {m.coverage}/{m.total} dates
                            </option>))}
                        </Select>
                      </Field>
                    </div>
                    <Button size="sm" variant="secondary" disabled={!pick[b.id]} onClick={() => assignTutor(pick[b.id])}>Assign selected tutor</Button>
                    <p className="w-full text-xs text-slate-500">Choose any other qualified tutor with approved availability. If none are listed, update a tutor’s approved schedule first.</p>
                  </div>)}
                {msg[b.id] && <div className="mt-2"><Alert kind="error">{msg[b.id]}</Alert></div>}
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <Button size="sm" variant="secondary" onClick={() => openScheduleEditor(b)}>
                  {proposalPending ? "Edit proposal" : "Edit schedule"}
                </Button>
                <Button size="sm" variant="danger" onClick={() => setRej(b)}>
                  Reject / request rescheduling
                </Button>
              </div>
            </Card>);
        })}
      </div>
      <Modal open={!!rej} onClose={() => setRej(null)} title="Request rescheduling">
        <div className="space-y-4">
          <Field label="Message to parent">
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)}/>
          </Field>
          <Button variant="danger" onClick={() => {
            s.rejectBooking(rej.id, reason);
            setRej(null);
        }}>
            Release slots & notify
          </Button>
        </div>
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Propose schedule change">
        <div className="space-y-4">
          <p className="text-sm text-slate-500">The tutee must approve these dates and times before tutor matching resumes.</p>
          <div className="space-y-2">
            {scheduleDraft.map((session, index) => (<div key={index} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
                <Field label={index === 0 ? "Date" : ""}>
                  <Input type="date" min={todayISO()} value={session.date} onChange={(e) => setScheduleDraft((current) => current.map((row, i) => i === index ? { ...row, date: e.target.value } : row))}/>
                </Field>
                <Field label={index === 0 ? "Time" : ""}>
                  <Select value={session.time} onChange={(e) => setScheduleDraft((current) => current.map((row, i) => i === index ? { ...row, time: e.target.value } : row))}>
                    {HOURS.map((hour) => <option key={hour} value={hour}>{fmtTime(hour)}</option>)}
                  </Select>
                </Field>
                <Button size="sm" variant="danger" onClick={() => setScheduleDraft((current) => current.filter((_, i) => i !== index))}>Remove</Button>
              </div>))}
          </div>
          <Button variant="secondary" onClick={() => setScheduleDraft((current) => [...current, { date: addDays(current[current.length - 1]?.date || todayISO(), 1), time: current[0]?.time || HOURS[0] }])}>Add session date</Button>
          {scheduleError && <Alert kind="error">{scheduleError}</Alert>}
          <Button onClick={async () => {
            const result = await s.proposeBookingSchedule(editing.id, scheduleDraft);
            if (!result.ok)
                return setScheduleError(result.error);
            setEditing(null);
        }}>
            Send for tutee approval
          </Button>
        </div>
      </Modal>
    </>);
}
