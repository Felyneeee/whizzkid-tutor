"use client";
import { useEffect, useState } from "react";
import { Alert, Badge, Button, Card, Empty, Field, Input, Modal, PageHeader, Select, Tabs, Textarea } from "@/components/ui";
import { addDays, fmtDate, fmtDateTime, todayISO } from "@/lib/dates";
import { useStore } from "@/lib/store";
export default function Approvals() {
    const s = useStore();
    const [tab, setTab] = useState("schedules");
    const [rej, setRej] = useState(null);
    const [reason, setReason] = useState("");
    const [lv, setLv] = useState({ start: addDays(todayISO(), 1), end: addDays(todayISO(), 1), reason: "" });
    const db = s.db;
    const [scheduleTutor, setScheduleTutor] = useState(() => db.tutors.find((t) => t.status === "active")?.userId ?? "");
    const [scheduleDays, setScheduleDays] = useState({});
    const [scheduleModalities, setScheduleModalities] = useState(["online", "face-to-face"]);
    const [scheduleResult, setScheduleResult] = useState(null);
    const tn = (id) => db.tutors.find((t) => t.userId === id)?.fullName || "Admin";
    const activeTutors = db.tutors.filter((t) => t.status === "active");
    const pendingBatches = Array.from(new Set(db.availability.filter((a) => a.status === "pending").map((a) => a.batchId)));
    const leaves = db.leaves.filter((l) => db.tutors.some((t) => t.userId === l.tutorId)).sort((a, b) => (a.status === "pending" ? -1 : 1) - (b.status === "pending" ? -1 : 1));
    const mine = db.leaves.filter((l) => l.tutorId === s.me.id);
    useEffect(() => {
        if (!db.tutors.some((t) => t.status === "active" && t.userId === scheduleTutor)) {
            setScheduleTutor(db.tutors.find((t) => t.status === "active")?.userId ?? "");
            return;
        }
        const savedDays = db.tutorSchedules?.[scheduleTutor]?.days || {};
        setScheduleDays(Object.fromEntries(Object.keys(savedDays).map((day) => [day, true])));
        setScheduleModalities(db.tutorSchedules?.[scheduleTutor]?.modalities || ["online", "face-to-face"]);
    }, [db.tutorSchedules, db.tutors, scheduleTutor]);
    const week = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const overlaps = week.map((day) => {
        const assigned = activeTutors.filter((t) => db.tutorSchedules?.[t.userId]?.days?.[day]);
        const off = activeTutors.filter((t) => db.tutorSchedules?.[t.userId] && !db.tutorSchedules[t.userId].days?.[day]);
        return { day, assigned, off };
    });
    return (<>
      <PageHeader title="Availability & leaves" subtitle="Approve or reject tutor schedule updates and leave requests. Pending items are never bookable."/>
      <Tabs tabs={[
            { id: "availability", label: "Availability", count: pendingBatches.length },
            { id: "schedules", label: "Tutor schedules" },
            { id: "leaves", label: "Tutor leaves", count: leaves.filter((l) => l.status === "pending").length },
            { id: "mine", label: "My leave form" },
        ]} value={tab} onChange={setTab}/>

      {tab === "availability" &&
            (pendingBatches.length === 0 ? (<Empty>No pending availability requests.</Empty>) : (<div className="space-y-4">
            {pendingBatches.map((b) => {
                    const recs = db.availability.filter((a) => a.batchId === b && a.status === "pending");
                    const conflict = recs[0].note?.includes("Conflicts");
                    return (<Card key={b} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-extrabold">{tn(recs[0].tutorId)}</div>
                      <div className="text-xs text-slate-500">Submitted {fmtDateTime(recs[0].submittedAt)} · {recs[0].modalities.join(" + ")}</div>
                    </div>
                    <Badge status="pending"/>
                  </div>
                  {conflict && <Alert kind="warn">{recs[0].note}</Alert>}
                  {!conflict && recs[0].note && <p className="text-sm text-slate-500">Note: {recs[0].note}</p>}
                  <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl bg-slate-50 p-3 text-sm">
                    {recs.map((r) => (<div key={r.id}>
                        <b>{fmtDate(r.date)}</b>: {r.slots.length ? r.slots.map(fmtTime).join(", ") : <i className="text-coral-600">unavailable (day off)</i>}
                      </div>))}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="success" size="sm" onClick={() => s.approveAvailability(b)}>Approve</Button>
                    <Button variant="danger" size="sm" onClick={() => setRej(b)}>Reject</Button>
                  </div>
                </Card>);
                })}
          </div>))}

      {tab === "schedules" && (<div className="space-y-4"><Card className="max-w-3xl space-y-5">
          <div>
            <h2 className="text-lg font-extrabold">Tutor weekly schedule</h2>
          </div>
          {activeTutors.length === 0 ? <Empty>No active tutors to edit.</Empty> : (<>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Tutor">
                  <Select value={scheduleTutor} onChange={(e) => { setScheduleTutor(e.target.value); setScheduleResult(null); }}>
                    {activeTutors.map((tutor) => <option key={tutor.userId} value={tutor.userId}>{tutor.fullName}</option>)}
                  </Select>
                </Field>
              </div>
              <div className="space-y-2">{week.map((day) => <div key={day} className="flex items-center justify-between rounded-xl border border-slate-100 p-3">
                <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={!!scheduleDays[day]} onChange={(e) => setScheduleDays((current) => { const next = { ...current }; if (e.target.checked) next[day] = true; else delete next[day]; return next; })}/>{day}</label>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${scheduleDays[day] ? "bg-mint-100 text-mint-600" : "bg-slate-100 text-slate-500"}`}>{scheduleDays[day] ? "Working day" : "Day off"}</span>
              </div>)}</div>
              <Field label="Modality">
                <div className="flex flex-wrap gap-4">
                  {["online", "face-to-face"].map((modality) => (<label key={modality} className="flex cursor-pointer items-center gap-2 text-sm capitalize">
                      <input type="checkbox" checked={scheduleModalities.includes(modality)} onChange={(e) => setScheduleModalities((current) => e.target.checked ? [...current, modality] : current.filter((x) => x !== modality))}/>
                      {modality}
                    </label>))}
                </div>
              </Field>
              <Button onClick={async () => {
                    const result = await s.setTutorWeeklySchedule(scheduleTutor, scheduleDays, scheduleModalities);
                    setScheduleResult(result.ok
                        ? { text: result.conflicts.length ? `Schedule saved. ${result.conflicts.length} affected session(s) were flagged for reassignment.` : "Tutor schedule saved and approved.", kind: result.conflicts.length ? "warn" : "success" }
                        : { text: result.error, kind: "error" });
                }}>Save weekly schedule</Button>
              {scheduleResult && <Alert kind={scheduleResult.kind}>{scheduleResult.text}</Alert>}
            </>)}
        </Card><Card><h3 className="mb-3 font-extrabold">Team schedule overview</h3><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{overlaps.map(({ day, assigned, off }) => <div key={day} className="rounded-xl bg-slate-50 p-3 text-sm"><b>{day}</b><div className="mt-1">Working: {assigned.length ? assigned.map((t) => t.fullName).join(", ") : "None assigned"}</div><div className="mt-1 text-coral-600">Off: {off.length ? off.map((t) => t.fullName).join(", ") : "None"}</div>{off.length > 1 && <div className="mt-1 font-bold text-amber-700">{off.length} tutors share this day off</div>}</div>)}</div></Card></div>)}

      {tab === "leaves" &&
            (leaves.length === 0 ? (<Empty>No leave requests.</Empty>) : (<div className="space-y-3">
            {leaves.map((l) => {
                    const affected = db.sessions.filter((x) => x.tutorId === l.tutorId && x.status === "scheduled" && x.date >= l.startDate && x.date <= l.endDate).length;
                    return (<Card key={l.id} className="flex flex-wrap items-center justify-between gap-3 !p-4">
                  <div>
                    <div className="font-extrabold">{tn(l.tutorId)}</div>
                    <div className="text-sm">{fmtDate(l.startDate)} → {fmtDate(l.endDate)}</div>
                    <div className="text-sm text-slate-500">{l.reason}</div>
                    {l.status === "pending" && affected > 0 && <div className="mt-1 text-xs font-bold text-coral-600">{affected} confirmed session(s) would need reassignment</div>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge status={l.status}/>
                    {l.status === "pending" && (<>
                        <Button size="sm" variant="success" onClick={() => s.decideLeave(l.id, true)}>Approve</Button>
                        <Button size="sm" variant="danger" onClick={() => s.decideLeave(l.id, false)}>Reject</Button>
                      </>)}
                  </div>
                </Card>);
                })}
          </div>))}

      {tab === "mine" && (<div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <form className="space-y-4" onSubmit={(e) => {
                e.preventDefault();
                s.adminLeave(s.me.id, lv.start, lv.end, lv.reason);
                setLv({ ...lv, reason: "" });
            }}>
              <div className="grid grid-cols-2 gap-3">
                <Field label="From"><Input type="date" value={lv.start} onChange={(e) => setLv({ ...lv, start: e.target.value })} required/></Field>
                <Field label="To"><Input type="date" min={lv.start} value={lv.end} onChange={(e) => setLv({ ...lv, end: e.target.value })} required/></Field>
              </div>
              <Field label="Reason"><Textarea required value={lv.reason} onChange={(e) => setLv({ ...lv, reason: e.target.value })}/></Field>
              <Button type="submit">Record admin leave</Button>
            </form>
          </Card>
          <div className="space-y-2">
            {mine.length === 0 && <Empty>No admin leave recorded.</Empty>}
            {mine.map((l) => (<Card key={l.id} className="!p-3 text-sm">{fmtDate(l.startDate)} → {fmtDate(l.endDate)} · {l.reason}</Card>))}
          </div>
        </div>)}

      <Modal open={!!rej} onClose={() => setRej(null)} title="Reject availability">
        <div className="space-y-4">
          <Field label="Reason (sent to tutor)"><Textarea value={reason} onChange={(e) => setReason(e.target.value)}/></Field>
          <Button variant="danger" onClick={() => { s.rejectAvailability(rej, reason || "Please revise your schedule."); setRej(null); setReason(""); }}>Reject & notify</Button>
        </div>
      </Modal>
    </>);
}
