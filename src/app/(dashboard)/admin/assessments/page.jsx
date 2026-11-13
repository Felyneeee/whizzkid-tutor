"use client";
import { useState } from "react";
import { Alert, Badge, Button, Card, Empty, Field, Input, Modal, PageHeader, Textarea, Select } from "@/components/ui";
import { READING_SKILLS } from "@/lib/constants";
import { fmtDate, fmtTime } from "@/lib/dates";
import { useStore } from "@/lib/store";

export default function Assessments() {
  const s = useStore();
  const [rec, setRec] = useState(null);
  const [f, setF] = useState({ readingLevel: "", results: "", learningNeeds: "" });
  const [schedule, setSchedule] = useState({});
  const [errors, setErrors] = useState({});
  const activeAssessments = s.db.assessments.filter((a) => ["pending_admin_scheduling", "booked"].includes(a.status));
  const activeTutees = new Set(activeAssessments.map((a) => a.tuteeId));
  const latestCompleted = new Map();
  s.db.assessments.filter((a) => a.status === "completed" && !activeTutees.has(a.tuteeId)).forEach((a) => latestCompleted.set(a.tuteeId, a));
  const list = [...activeAssessments, ...latestCompleted.values()].sort((a, b) => (a.status === "pending_admin_scheduling" ? -1 : 1) - (b.status === "pending_admin_scheduling" ? -1 : 1) || `${a.date ?? ""}${a.time ?? ""}`.localeCompare(`${b.date ?? ""}${b.time ?? ""}`));
  const nm = (id) => s.db.tutees.find((t) => t.userId === id);
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
    <PageHeader title="Reading assessments" subtitle="Schedule initial assessments for program requests, then record results and learning needs." />
    {list.length === 0 && <Empty>No assessment requests yet.</Empty>}
    <div className="space-y-3">
      {list.map((a) => {
        const linkedBooking = s.db.bookings.find((booking) => booking.assessmentId === a.id && booking.program === "reading");
        return <Card key={a.id} className="space-y-3 !p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="font-extrabold">{nm(a.tuteeId)?.fullName} <span className="text-sm font-normal text-slate-500">· {nm(a.tuteeId)?.gradeLevel}, {nm(a.tuteeId)?.age ?? "?"} y/o</span></div>
            <div className="mt-1 text-sm text-slate-600">{a.date ? `${fmtDate(a.date)} · ${fmtTime(a.time)}` : "Awaiting admin scheduling"} · <Badge status={a.modality} /></div>
            {linkedBooking && <p className="mt-2 text-sm font-semibold text-brand-700">Linked Reading booking · {linkedBooking.sessionSlots?.length ?? linkedBooking.dates.length} tutoring sessions · {linkedBooking.status === "assessment_scheduled" ? "assessment scheduled" : linkedBooking.status === "ready_for_matching" ? "ready for tutor confirmation" : linkedBooking.status}</p>}
            {a.learningNeeds && <p className="mt-2 text-sm text-slate-600">{a.status === "pending_admin_scheduling" ? "Parent's reading goals" : "Learning needs"}: {a.learningNeeds}</p>}
            {a.status === "completed" && <p className="mt-2 text-sm text-slate-600"><b>Reading level: {a.readingLevel}</b><br />Assessment results: {a.results}</p>}
          </div>
          <Badge status={a.status} />
        </div>
        {a.status === "pending_admin_scheduling" && <div className="border-t border-slate-100 pt-3">
          <p className="mb-2 text-sm font-bold">Schedule initial assessment</p>
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Assessment date"><Input type="date" min={new Date().toISOString().slice(0, 10)} value={schedule[a.id]?.date || ""} onChange={(e) => setSchedule((v) => ({ ...v, [a.id]: { ...v[a.id], date: e.target.value, time: v[a.id]?.time || "09:00" } }))} /></Field>
            <Field label="Start time (assessment ends by 10 AM)"><Select value={schedule[a.id]?.time || "09:00"} onChange={(e) => setSchedule((v) => ({ ...v, [a.id]: { ...v[a.id], time: e.target.value } }))}>{["09:00", "09:15", "09:30", "09:45"].map((time) => { const occupied = s.db.assessments.some((x) => x.id !== a.id && x.status === "booked" && x.date === schedule[a.id]?.date && x.time === time); return <option key={time} value={time} disabled={occupied}>{fmtTime(time)}{occupied ? " (booked)" : ""}</option>; })}</Select></Field>
            <Button disabled={!schedule[a.id]?.date} onClick={() => scheduleAssessment(a)}>Schedule & notify tutee</Button>
          </div>
        </div>}
        {a.status === "booked" && <Button size="sm" onClick={() => { setRec(a); setF({ readingLevel: "", results: "", learningNeeds: "" }); }}>Enter assessment results</Button>}
        {errors[a.id] && <Alert kind="error">{errors[a.id]}</Alert>}
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
  </>;
}
