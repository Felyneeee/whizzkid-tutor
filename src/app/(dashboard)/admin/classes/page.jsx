"use client";
import { useState } from "react";
import { Badge, Button, Card, Field, Input, Modal, PageHeader, Select } from "@/components/ui";
import { DAY_NAMES, fmtDate, fmtTime, todayISO } from "@/lib/dates";
import { cohortSessionDates } from "@/lib/logic";
import { useStore } from "@/lib/store";
export default function Classes() {
    const s = useStore();
    const [cohortOpen, setCohortOpen] = useState(false);
    const [c, setC] = useState({ label: "", startDate: todayISO(), weekdays: [1, 3, 5], time: "10:00", capacity: 6, tutorId: "" });
    const nm = (id) => s.db.tutees.find((t) => t.userId === id)?.fullName || id;
    const tutors = s.db.tutors.filter((t) => t.status === "active");
    return (<>
      <PageHeader title="Playgroup classes" subtitle="Manage cohort capacity, modality and teacher assignment. The assigned teacher coordinates the class location." action={<Button onClick={() => setCohortOpen(true)}>New cohort</Button>}/>
      <div className="mb-8 space-y-4">
        {s.db.cohorts.map((k) => {
            const dates = cohortSessionDates(k);
            return (<Card key={k.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-extrabold">{k.label}</div>
                  <div className="text-sm text-slate-500">{k.weekdays.map((d) => DAY_NAMES[d]).join("/")} · {fmtTime(k.time)} · {k.modality ?? "face-to-face"} · starts {fmtDate(k.startDate)} · {dates.length} sessions</div>
                </div>
                <Badge status={k.enrolled.length >= k.capacity ? "rejected" : "approved"}>{k.enrolled.length}/{k.capacity} enrolled</Badge>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <Field label="Capacity"><Input type="number" min={k.enrolled.length || 1} value={k.capacity} onChange={(e) => s.updateCohort(k.id, { capacity: Math.max(k.enrolled.length, Number(e.target.value)) })}/></Field>
                <Field label="Teacher"><Select value={k.tutorId ?? ""} onChange={(e) => s.updateCohort(k.id, { tutorId: e.target.value || undefined })}><option value="">Unassigned</option>{tutors.map((t) => <option key={t.userId} value={t.userId}>{t.fullName}</option>)}</Select></Field>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {k.enrolled.length === 0 && <span className="text-sm text-slate-400">No enrollees yet.</span>}
                {k.enrolled.map((id) => <span key={id} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">{nm(id)}<button aria-label="Remove" className="text-coral-600" onClick={() => confirm(`Remove ${nm(id)} from this cohort?`) && s.removeFromCohort(k.id, id)}>×</button></span>)}
              </div>
            </Card>);
        })}
      </div>
      <Modal open={cohortOpen} onClose={() => setCohortOpen(false)} title="New playgroup cohort">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); s.addCohort({ ...c, tutorId: c.tutorId || undefined, sessionsCount: 12 }); setCohortOpen(false); }}>
          <Field label="Label"><Input required value={c.label} onChange={(e) => setC({ ...c, label: e.target.value })} placeholder="e.g. November Morning Group"/></Field>
          <Field label="Start date"><Input type="date" required value={c.startDate} onChange={(e) => setC({ ...c, startDate: e.target.value })}/></Field>
          <Button type="submit">Create cohort</Button>
        </form>
      </Modal>
    </>);
}
