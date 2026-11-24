"use client";
import { useState } from "react";
import { Alert, Button, Card, Empty, Field, FilterPopover, FilterTrigger, Input, Modal, PageHeader, Textarea, Select, peso } from "@/components/ui";
import { READING_SKILLS } from "@/lib/constants";
import { fmtDate, fmtTime, isAssessmentOutdated } from "@/lib/dates";
import { useStore } from "@/lib/store";

export default function Assessments({ embedded = false, onAssignTutor } = {}) {
  const s = useStore();
  const [rec, setRec] = useState(null);
  const [f, setF] = useState({ readingLevel: "", results: "", learningNeeds: "" });
  const [schedule, setSchedule] = useState({});
  const [schedulingId, setSchedulingId] = useState(null);
  const [errors, setErrors] = useState({});
  const [sortOrder, setSortOrder] = useState("newest");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [scheduleBooking, setScheduleBooking] = useState(null);
  const activeAssessments = s.db.assessments.filter((a) => ["pending_admin_scheduling", "booked"].includes(a.status));
  const activeTutees = new Set(activeAssessments.map((a) => a.tuteeId));
  const latestCompleted = new Map();
  s.db.assessments.filter((a) => a.status === "completed" && !activeTutees.has(a.tuteeId)).forEach((a) => {
    const booking = s.db.bookings.find((entry) => entry.assessmentId === a.id && entry.program === "reading");
    const activeRequest = booking && ["pending_assessment", "assessment_scheduled", "ready_for_matching", "to_pay", "awaiting_payment_approval", "confirmed", "awaiting_admin"].includes(booking.status);
    const alreadyAssigned = booking && (booking.tutorId || s.db.sessions.some((session) => session.bookingId === booking.id && session.tutorId && session.status !== "cancelled"));
    if (activeRequest && !alreadyAssigned) latestCompleted.set(a.tuteeId, a);
  });
  const nm = (id) => s.db.tutees.find((t) => t.userId === id);
  const list = [...activeAssessments, ...latestCompleted.values()].sort((a, b) => {
    const comparison = String(a.createdAt || a.date || "").localeCompare(String(b.createdAt || b.date || ""));
    return sortOrder === "newest" ? -comparison : comparison;
  });
  const scheduleAssessment = async (assessment) => {
    setErrors((v) => ({ ...v, [assessment.id]: "" }));
    const result = await s.scheduleAssessment(assessment.id, schedule[assessment.id]?.date, schedule[assessment.id]?.time || "09:00");
    if (!result?.ok) setErrors((v) => ({ ...v, [assessment.id]: result?.error || "Could not schedule the initial assessment." }));
  };
  const saveResults = async (event) => {
    event.preventDefault();
    const result = await s.completeAssessment(rec.id, f);
    if (!result?.ok) {
      setErrors((v) => ({ ...v, [rec.id]: result?.error || "Could not save assessment results." }));
      return;
    }
    setRec(null);
  };

  return <>
    {!embedded && <PageHeader title="Reading assessments" subtitle="Schedule initial assessments for program requests, then record results and learning needs." />}
    {list.length > 0 && <div className="relative mb-3 flex justify-end"><FilterTrigger onClick={() => setFiltersOpen((open) => !open)} ariaLabel="Filter reading requests" expanded={filtersOpen} count={sortOrder !== "newest" ? 1 : 0}/>{filtersOpen && <FilterPopover onClear={() => setSortOrder("newest")} onApply={() => setFiltersOpen(false)}><fieldset><legend className="mb-2 text-xs font-extrabold text-slate-700">Sort by</legend><div className="space-y-1">{[["newest", "Newest first"], ["oldest", "Oldest first"]].map(([value, label]) => <label key={value} className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 hover:bg-brand-50"><input type="radio" name="reading-request-sort" checked={sortOrder === value} onChange={() => setSortOrder(value)} className="accent-brand-600"/>{label}</label>)}</div></fieldset></FilterPopover>}</div>}
    {list.length === 0 && <Empty>No assessment requests yet.</Empty>}
    <div className="space-y-3">
      {list.map((a) => {
        const linkedBooking = s.db.bookings.find((booking) => booking.assessmentId === a.id && booking.program === "reading");
        const tutee = nm(a.tuteeId);
        const outdated = isAssessmentOutdated(a);
        const slots = linkedBooking?.sessionSlots || (linkedBooking?.dates || []).map((date) => ({ date, time: linkedBooking.sessionTimes?.[date] ?? linkedBooking.time }));
        const assigned = linkedBooking && s.db.sessions.some((session) => session.bookingId === linkedBooking.id && session.tutorId && session.status !== "cancelled");
        const statusText = outdated ? "Outdated" : a.status === "pending_admin_scheduling" ? "Pending" : a.status === "booked" ? "Pending" : "Pending";
        return <Card key={a.id} className="space-y-4 !rounded-3xl !border-0 !p-5 shadow-sm sm:!px-7 sm:!py-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><div className="font-extrabold text-slate-800">{tutee?.fullName} · {tutee?.age ?? "?"} y/o</div><div className="text-sm font-bold text-slate-600">{slots.length} sessions · {peso(linkedBooking?.totalFee || 0)} · {a.modality === "face-to-face" ? "Face-to-Face" : "Online"}</div></div>
            <span className="min-w-36 rounded-xl bg-amber-100 px-4 py-2 text-center text-sm font-extrabold text-amber-700">{statusText}</span>
          </div>
          <div className="font-semibold">Initial Assessment: {outdated ? <span className="text-red-600">Outdated</span> : a.status === "pending_admin_scheduling" ? "N/A" : a.status === "booked" ? fmtDate(a.date) : "Completed"}</div>
          {a.status === "completed" && <div className="space-y-1 text-sm font-semibold text-slate-700"><p>Reading Level: {a.readingLevel || "N/A"}</p><p>Assessment Result: {a.results || "N/A"}</p><p>Learning Needs: {a.learningNeeds || "N/A"}</p></div>}
          <div className="grid gap-3 sm:grid-cols-2">
            {a.status === "pending_admin_scheduling" && <Button className="w-full rounded-2xl py-4" onClick={() => setSchedulingId(schedulingId === a.id ? null : a.id)}>Schedule Initial Assessment</Button>}
            {a.status === "booked" && <Button className="w-full rounded-2xl py-4" onClick={() => { setRec(a); setF({ readingLevel: "", results: "", learningNeeds: "" }); }}>Enter Assessment Results</Button>}
            {a.status === "completed" && (outdated ? linkedBooking && !assigned && <Button className="w-full rounded-2xl py-4" onClick={async () => { const result = await s.renewReadingAssessment(linkedBooking.id); if (!result?.ok) setErrors((v) => ({ ...v, [a.id]: result?.error || "A new assessment request could not be created." })); }}>Schedule Initial Assessment</Button> : linkedBooking && !assigned && onAssignTutor && <Button className="w-full rounded-2xl py-4" onClick={onAssignTutor}>Assign a Tutor</Button>)}
            {linkedBooking && <Button className="w-full rounded-2xl py-4" onClick={() => setScheduleBooking(linkedBooking)}>View Requested Schedule</Button>}
          </div>
          {schedulingId === a.id && a.status === "pending_admin_scheduling" && <div className="grid gap-3 rounded-2xl bg-slate-50 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <Field label="Assessment date"><Input type="date" min={new Date().toISOString().slice(0, 10)} value={schedule[a.id]?.date || ""} onChange={(event) => setSchedule((v) => ({ ...v, [a.id]: { ...v[a.id], date: event.target.value, time: v[a.id]?.time || "09:00" } }))} /></Field>
            <Field label="Start time (assessment ends by 10 AM)"><Select value={schedule[a.id]?.time || "09:00"} onChange={(event) => setSchedule((v) => ({ ...v, [a.id]: { ...v[a.id], time: event.target.value } }))}>{["09:00", "09:15", "09:30", "09:45"].map((time) => { const occupied = s.db.assessments.some((x) => x.id !== a.id && x.status === "booked" && x.date === schedule[a.id]?.date && x.time === time); return <option key={time} value={time} disabled={occupied}>{fmtTime(time)}{occupied ? " (booked)" : ""}</option>; })}</Select></Field>
            <Button disabled={!schedule[a.id]?.date} onClick={() => scheduleAssessment(a)}>Send Schedule</Button>
          </div>}
          {errors[a.id] && <Alert kind="error">{errors[a.id]}</Alert>}
          <p className="text-sm text-slate-400">Booked on {linkedBooking?.createdAt || a.createdAt ? new Date(linkedBooking?.createdAt || a.createdAt).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" }) : "—"}</p>
        </Card>;
      })}
    </div>
    <Modal open={!!rec} onClose={() => setRec(null)} title="Record assessment results">
      {rec && <form className="space-y-4" onSubmit={saveResults}>
        <Field label="Reading level" hint={`Skill areas: ${READING_SKILLS.join(", ")}`}><Input required value={f.readingLevel} onChange={(e) => setF({ ...f, readingLevel: e.target.value })} placeholder="e.g. Sight Words – Level 2" /></Field>
        <Field label="Assessment results"><Textarea required value={f.results} onChange={(e) => setF({ ...f, results: e.target.value })} /></Field>
        <Field label="Learning needs"><Textarea required value={f.learningNeeds} onChange={(e) => setF({ ...f, learningNeeds: e.target.value })} /></Field>
        {errors[rec.id] && <Alert kind="error">{errors[rec.id]}</Alert>}
        <Button type="submit">Save & notify parent</Button>
      </form>}
    </Modal>
    <Modal open={!!scheduleBooking} onClose={() => setScheduleBooking(null)} title="Requested Reading Schedule">
      {scheduleBooking ? <div className="space-y-3">{(scheduleBooking.sessionSlots || (scheduleBooking.dates || []).map((date) => ({ date, time: scheduleBooking.sessionTimes?.[date] ?? scheduleBooking.time }))).map((slot, index) => <div key={`${slot.date}-${slot.time}-${index}`} className="flex justify-between rounded-xl bg-slate-50 p-3 text-sm font-semibold"><span>{fmtDate(slot.date)}</span><span>{fmtTime(slot.time)}</span></div>)}{!scheduleBooking.dates?.length && !scheduleBooking.sessionSlots?.length && <Empty>No tutoring sessions were requested.</Empty>}</div> : <Empty>No requested schedule available.</Empty>}
    </Modal>
  </>;
}
