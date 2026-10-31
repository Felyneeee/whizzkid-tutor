"use client";
import { useState } from "react";
import { Badge, Button, Card, Empty, Field, Input, Modal, PageHeader, Textarea } from "@/components/ui";
import { READING_SKILLS } from "@/lib/constants";
import { fmtDate, fmtTime } from "@/lib/dates";
import { useStore } from "@/lib/store";
export default function Assessments() {
    const s = useStore();
    const [rec, setRec] = useState(null);
    const [f, setF] = useState({ readingLevel: "", results: "", learningNeeds: "" });
    const list = s.db.assessments.filter((a) => a.status !== "cancelled").sort((a, b) => (a.status === "booked" ? -1 : 1) - (b.status === "booked" ? -1 : 1) || (a.date + a.time).localeCompare(b.date + b.time));
    const nm = (id) => s.db.tutees.find((t) => t.userId === id);
    return (<>
      <PageHeader title="Reading assessments" subtitle="Record assessment results and learning needs so the tutee can proceed to matching."/>
      {list.length === 0 && <Empty>No assessments booked yet.</Empty>}
      <div className="space-y-3">
        {list.map((a) => (<Card key={a.id} className="flex flex-wrap items-center justify-between gap-3 !p-4">
            <div>
              <div className="font-extrabold">{nm(a.tuteeId)?.fullName} <span className="text-sm font-normal text-slate-500">· {nm(a.tuteeId)?.gradeLevel}, {nm(a.tuteeId)?.age ?? "?"} y/o</span></div>
              <div className="text-sm text-slate-600">{fmtDate(a.date)} · {fmtTime(a.time)} · <Badge status={a.modality}/></div>
              {a.status === "completed" && <div className="mt-1 text-sm text-slate-500"><b>{a.readingLevel}</b> — {a.results} <i>({a.learningNeeds})</i></div>}
            </div>
            <div className="flex items-center gap-2">
              <Badge status={a.status}/>
              {a.status === "booked" && <Button size="sm" onClick={() => { setRec(a); setF({ readingLevel: "", results: "", learningNeeds: "" }); }}>Record results</Button>}
            </div>
          </Card>))}
      </div>
      <Modal open={!!rec} onClose={() => setRec(null)} title="Record assessment results">
        <form className="space-y-4" onSubmit={(e) => {
            e.preventDefault();
            s.completeAssessment(rec.id, f);
            setRec(null);
        }}>
          <Field label="Reading level" hint={`Skill areas: ${READING_SKILLS.join(", ")}`}>
            <Input required value={f.readingLevel} onChange={(e) => setF({ ...f, readingLevel: e.target.value })} placeholder="e.g. Sight Words – Level 2"/>
          </Field>
          <Field label="Assessment results"><Textarea required value={f.results} onChange={(e) => setF({ ...f, results: e.target.value })}/></Field>
          <Field label="Learning needs"><Textarea required value={f.learningNeeds} onChange={(e) => setF({ ...f, learningNeeds: e.target.value })}/></Field>
          <Button type="submit">Save & notify parent</Button>
        </form>
      </Modal>
    </>);
}
