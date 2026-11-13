"use client";
import { useEffect, useState } from "react";
import { Alert, Badge, Button, Card, Empty, Field, PageHeader, Select, Tabs } from "@/components/ui";
import { fmtDate } from "@/lib/dates";
import { useStore } from "@/lib/store";
export default function Approvals() {
    const s = useStore();
    const [tab, setTab] = useState("schedules");
    const db = s.db;
    const [scheduleTutor, setScheduleTutor] = useState(() => db.tutors.find((t) => t.status === "active")?.userId ?? "");
    const [scheduleDays, setScheduleDays] = useState({});
    const [scheduleModalities, setScheduleModalities] = useState(["online", "face-to-face"]);
    const [scheduleResult, setScheduleResult] = useState(null);
    const tn = (id) => db.tutors.find((t) => t.userId === id)?.fullName || "Admin";
    const activeTutors = db.tutors.filter((t) => t.status === "active");
    const leaves = db.leaves.filter((l) => db.tutors.some((t) => t.userId === l.tutorId)).sort((a, b) => (a.status === "pending" ? -1 : 1) - (b.status === "pending" ? -1 : 1));
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
            { id: "schedules", label: "Tutor schedules" },
            { id: "leaves", label: "Tutor leaves", count: leaves.filter((l) => l.status === "pending").length },
        ]} value={tab} onChange={setTab}/>

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

    </>);
}
