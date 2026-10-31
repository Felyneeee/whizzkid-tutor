"use client";
import { useState } from "react";
import { Calendar } from "@/components/Calendar";
import { Alert, Badge, Button, Card, Empty, Field, Input, Modal, PageHeader, Select, Table, Tabs, Td, Textarea } from "@/components/ui";
import { addDays, fmtDate, fmtDateTime, fmtTime, todayISO } from "@/lib/dates";
import { HOURS } from "@/lib/constants";
import { approvedSlot, onApprovedLeave, tutorBusy } from "@/lib/logic";
import { useStore } from "@/lib/store";
export default function Scheduling() {
    const s = useStore();
    const [tab, setTab] = useState("sessions");
    const [term, setTerm] = useState(null);
    const [reschedule, setReschedule] = useState(null);
    const [rescheduleError, setRescheduleError] = useState("");
    const [reason, setReason] = useState("Program completed");
    const [err, setErr] = useState("");
    const [pick, setPick] = useState({});
    const today = todayISO();
    const [selectedDate, setSelectedDate] = useState(today);
    const db = s.db;
    const tn = (id) => db.tutors.find((t) => t.userId === id)?.fullName || "—";
    const un = (id) => db.tutees.find((t) => t.userId === id)?.fullName || "—";
    const subj = (id) => db.bookings.find((b) => b.id === id)?.subject || "";
    const flagged = db.sessions.filter((x) => x.status === "needs_reassignment");
    const sessions = db.sessions.filter((x) => x.status !== "cancelled");
    const sessionsByDate = {};
    sessions.forEach((session) => { var _a; return (sessionsByDate[_a = session.date] ?? (sessionsByDate[_a] = [])).push(session); });
    const daySessions = [...(sessionsByDate[selectedDate] ?? [])].sort((a, b) => a.time.localeCompare(b.time));
    const contracts = db.bookings.filter((b) => ["confirmed", "completed", "terminated"].includes(b.status));
    const eligible = (sessionId) => {
        const x = db.sessions.find((y) => y.id === sessionId);
        return db.tutors.filter((t) => t.status === "active" && t.userId !== x.tutorId && approvedSlot(db, t.userId, x.date, x.time, x.modality) && !onApprovedLeave(db, t.userId, x.date) && !tutorBusy(db, t.userId, x.date, x.time));
    };
    return (<>
      <PageHeader title="Scheduling & contracts" subtitle="Manage calendars, verify session completion, resolve conflicts and terminate contracts."/>

      {flagged.length > 0 && (<Card className="mb-6 border-coral-100 bg-coral-50">
          <h2 className="mb-2 font-extrabold text-coral-600">Conflicts needing reassignment ({flagged.length})</h2>
          <div className="space-y-2">
            {flagged.map((x) => {
                const opts = eligible(x.id);
                return (<div key={x.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-white p-3 text-sm">
                  <div className="min-w-[200px] flex-1">
                    <b>{fmtDate(x.date)} {fmtTime(x.time)}</b> · {un(x.tuteeId)} · {subj(x.bookingId)} · was {tn(x.tutorId)}
                  </div>
                  <Select className="!w-48" value={pick[x.id] || ""} onChange={(e) => setPick({ ...pick, [x.id]: e.target.value })}>
                    <option value="">{opts.length ? "Choose tutor…" : "No tutor free"}</option>
                    {opts.map((t) => (<option key={t.userId} value={t.userId}>{t.fullName}</option>))}
                  </Select>
                  <Button size="sm" disabled={!pick[x.id]} onClick={async () => { const r = await s.reassignSession(x.id, pick[x.id]); setErr(r.ok ? "" : r.error); }}>Reassign</Button>
                  <Button size="sm" variant="danger" onClick={() => s.cancelSession(x.id)}>Cancel & reschedule</Button>
                </div>);
            })}
          </div>
          {err && <div className="mt-2"><Alert kind="error">{err}</Alert></div>}
        </Card>)}

      <Tabs tabs={[{ id: "sessions", label: "Sessions" }, { id: "contracts", label: "Contracts", count: 0 }]} value={tab} onChange={setTab}/>

      {tab === "sessions" ? (<div className="grid items-start gap-5 lg:grid-cols-[minmax(320px,0.85fr)_minmax(0,1.4fr)]">
          <Card className="p-3 sm:p-5">
            <Calendar selected={[selectedDate]} onSelect={setSelectedDate} allowPast initialMonth={selectedDate} mark={(date) => {
                const count = sessionsByDate[date]?.length ?? 0;
                return count ? { text: `${count} session${count === 1 ? "" : "s"}`, tone: "brand" } : null;
            }}/>
            <div className="mt-4 flex items-center justify-between gap-2">
              <Button size="sm" variant="secondary" onClick={() => setSelectedDate(addDays(selectedDate, -1))}>Previous day</Button>
              <Button size="sm" variant="ghost" onClick={() => setSelectedDate(today)}>Today</Button>
              <Button size="sm" variant="secondary" onClick={() => setSelectedDate(addDays(selectedDate, 1))}>Next day</Button>
            </div>
          </Card>
          <section className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="text-xl font-extrabold">{fmtDate(selectedDate)}</h2>
                <p className="text-sm text-slate-500">{daySessions.length} scheduled session{daySessions.length === 1 ? "" : "s"}</p>
              </div>
            </div>
            {daySessions.length === 0 ? <Card><Empty>No sessions on this day.</Empty></Card> : daySessions.map((x) => {
                const proposal = db.bookings.find((booking) => booking.id === x.bookingId)?.scheduleProposal;
                const proposedSession = proposal?.sessionId === x.id ? proposal.sessions[0] : undefined;
                return (<Card key={x.id} className="flex flex-wrap items-center gap-3">
                <div className="min-w-20 rounded-xl bg-brand-50 px-3 py-2 text-center font-extrabold text-brand-700">{fmtTime(x.time)}</div>
                <div className="min-w-[180px] flex-1">
                  <div className="font-bold">{un(x.tuteeId)} <span className="font-normal text-slate-400">with</span> {tn(x.tutorId)}</div>
                  <div className="text-sm text-slate-500">{subj(x.bookingId)} · <Badge status={x.modality}/></div>
                  {x.tuteeCheckedInAt && <div className="mt-1 text-xs font-semibold text-mint-600">Tutee checked in {fmtDateTime(x.tuteeCheckedInAt)}</div>}
                </div>
                <Badge status={x.status}/>
                {proposedSession && <Alert kind="warn">Proposed change to {fmtDate(proposedSession.date)} at {fmtTime(proposedSession.time)} is awaiting tutee approval.</Alert>}
                {x.status === "completed" && x.attended === false && <span className="text-xs text-coral-600">No-show</span>}
                {x.status === "scheduled" && x.date <= today && <div className="flex gap-1">
                  <Button size="sm" variant="success" onClick={() => s.completeSession(x.id, true)}>Completed</Button>
                  <Button size="sm" variant="secondary" onClick={() => s.completeSession(x.id, false)}>No-show</Button>
                </div>}
                {x.status === "scheduled" && x.date > today && <Button size="sm" variant="ghost" onClick={() => s.cancelSession(x.id)}>Cancel</Button>}
                {(x.status === "scheduled" || x.status === "needs_reassignment") && x.date >= today && (<Button size="sm" variant="secondary" onClick={() => { setReschedule({ id: x.id, date: proposedSession?.date ?? x.date, time: proposedSession?.time ?? x.time }); setRescheduleError(""); }}>{proposedSession ? "Edit proposal" : "Reschedule"}</Button>)}
              </Card>);
            })}
          </section>
        </div>) : contracts.length === 0 ? (<Empty>No contracts yet.</Empty>) : (<Table head={["Tutee", "Tutor", "Program", "Sessions", "Fee", "Status", ""]}>
          {contracts.map((b) => (<tr key={b.id}>
              <Td>{un(b.tuteeId)}</Td>
              <Td>{b.tutorId ? tn(b.tutorId) : "—"}</Td>
              <Td>{b.subject} <span className="text-xs text-slate-400">({b.bookingType})</span></Td>
              <Td>{db.sessions.filter((x) => x.bookingId === b.id && x.status === "completed").length}/{b.dates.length}</Td>
              <Td>₱{b.totalFee.toLocaleString()}</Td>
              <Td><Badge status={b.status}/></Td>
              <Td>{b.status === "confirmed" && <Button size="sm" variant="danger" onClick={() => setTerm(b)}>Terminate contract</Button>}</Td>
            </tr>))}
        </Table>)}

      <Modal open={!!term} onClose={() => setTerm(null)} title="Terminate contract">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">Future sessions will be cancelled and both parties notified. This is recorded in activity history.</p>
          <Field label="Reason">
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)}/>
          </Field>
          <Button variant="danger" onClick={() => { s.terminateBooking(term.id, reason); setTerm(null); }}>Terminate</Button>
        </div>
      </Modal>
      <Modal open={!!reschedule} onClose={() => setReschedule(null)} title="Propose session reschedule">
        <div className="space-y-4">
          <p className="text-sm text-slate-500">The tutee must approve the change first. The assigned tutor must also have approved availability at the proposed time.</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="New date"><Input type="date" min={today} value={reschedule?.date ?? ""} onChange={(e) => setReschedule((current) => current ? { ...current, date: e.target.value } : current)}/></Field>
            <Field label="New time">
              <Select value={reschedule?.time ?? ""} onChange={(e) => setReschedule((current) => current ? { ...current, time: e.target.value } : current)}>
                {HOURS.map((hour) => <option key={hour} value={hour}>{fmtTime(hour)}</option>)}
              </Select>
            </Field>
          </div>
          {rescheduleError && <Alert kind="error">{rescheduleError}</Alert>}
          <Button onClick={async () => {
            const result = await s.proposeSessionReschedule(reschedule.id, reschedule.date, reschedule.time);
            if (!result.ok)
                return setRescheduleError(result.error);
            setReschedule(null);
        }}>Send to tutee for approval</Button>
        </div>
      </Modal>
    </>);
}
