"use client";
import { useEffect, useMemo, useState } from "react";
import { Alert, Badge, Button, Card, Empty, Field, Modal, PageHeader, Select, Tabs } from "@/components/ui";
import { fmtDate } from "@/lib/dates";
import { useStore } from "@/lib/store";

const WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const mondayOf = (date) => {
  const monday = new Date(date);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return monday;
};
const asISO = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const scheduleDateLabel = (date) => date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export default function Approvals({ embedded = false, defaultTab = "schedules" } = {}) {
  const s = useStore();
  const db = s.db;
  const [tab, setTab] = useState(defaultTab);
  const activeTutors = db.tutors.filter((tutor) => tutor.status === "active");
  const [scheduleTutor, setScheduleTutor] = useState(() => activeTutors[0]?.userId ?? "");
  const [scheduleDays, setScheduleDays] = useState({});
  const [scheduleResult, setScheduleResult] = useState(null);
  const [leaveForm, setLeaveForm] = useState(null);
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const leaves = db.leaves.filter((leave) => db.tutors.some((tutor) => tutor.userId === leave.tutorId)).sort((a, b) => (a.status === "pending" ? -1 : 1) - (b.status === "pending" ? -1 : 1));
  const selectedWeek = useMemo(() => WEEK.map((day, index) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + index);
    return { day, date };
  }), [weekStart]);
  const isCurrentWeek = weekStart.getTime() === mondayOf(new Date()).getTime();
  const tn = (id) => db.tutors.find((tutor) => tutor.userId === id)?.fullName || "Admin";

  useEffect(() => {
    if (!activeTutors.some((tutor) => tutor.userId === scheduleTutor)) {
      setScheduleTutor(activeTutors[0]?.userId ?? "");
      return;
    }
    const savedDays = db.tutorSchedules?.[scheduleTutor]?.days || {};
    setScheduleDays(Object.fromEntries(Object.keys(savedDays).map((day) => [day, true])));
  }, [db.tutorSchedules, db.tutors, scheduleTutor]);

  const toggleDay = (day) => setScheduleDays((current) => {
    const next = { ...current };
    if (next[day]) delete next[day];
    else next[day] = true;
    return next;
  });
  const changeWeek = (amount) => setWeekStart((current) => {
    const next = new Date(current);
    next.setDate(next.getDate() + amount * 7);
    return next;
  });

  return <>
    {!embedded && <PageHeader title="Availability & leaves" />}
    {!embedded && <Tabs tabs={[
      { id: "schedules", label: "Tutor schedules" },
      { id: "leaves", label: "Tutor leaves", count: leaves.filter((leave) => leave.status === "pending").length },
    ]} value={tab} onChange={setTab} />}

    {tab === "schedules" && <Card className="space-y-8 !p-6 sm:!p-8">
      <section>
        <h2 className="mb-4 text-2xl font-extrabold tracking-tight text-slate-900">Tutor Weekly Schedule</h2>
        {activeTutors.length === 0 ? <Empty>No active tutors to edit.</Empty> : <>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <Field label="Tutor">
              <Select className="min-w-[240px] !rounded-2xl !border-2 !border-slate-300 !px-4 !py-3 !text-base font-semibold" value={scheduleTutor} onChange={(event) => { setScheduleTutor(event.target.value); setScheduleResult(null); }}>
                <option value="">Select Tutor</option>
                {activeTutors.map((tutor) => <option key={tutor.userId} value={tutor.userId}>{tutor.fullName}</option>)}
              </Select>
            </Field>
            <Button variant="secondary" className="!rounded-full !border-2 !border-slate-300 !px-6" onClick={() => { setScheduleDays({}); setScheduleResult(null); }}>Clear</Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {WEEK.map((day) => {
              const working = !!scheduleDays[day];
              return <button type="button" key={day} onClick={() => toggleDay(day)} aria-pressed={working} className={`relative flex min-h-32 flex-col items-center justify-center rounded-3xl p-4 shadow-[0_5px_18px_rgba(15,23,42,0.12)] transition hover:-translate-y-0.5 ${working ? "bg-[#d9edca]" : "bg-[#d0d0d0]"}`}>
                <span className={`absolute right-3 top-3 grid h-5 w-5 place-items-center rounded-full text-xs font-black ${working ? "bg-lime-600 text-white" : "bg-white/80 text-transparent"}`}>{working ? "✓" : "•"}</span>
                <span className="text-2xl font-extrabold text-slate-800">{day}</span>
                <span className={`mt-3 inline-flex min-w-36 items-center justify-center gap-2 rounded-full px-4 py-1.5 text-base font-bold ${working ? "bg-[#c5ffb7] text-green-600" : "bg-white/50 text-slate-600"}`}>
                  <span className={`h-2.5 w-2.5 rounded-full ${working ? "bg-green-700/60" : "bg-slate-500/60"}`} />{working ? "Working" : "Day off"}
                </span>
              </button>;
            })}
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-end gap-4">
            <Button disabled={!scheduleTutor || Object.keys(scheduleDays).length !== 5} className="!rounded-2xl !px-6 !py-3 !text-base" onClick={async () => {
              const modalities = db.tutorSchedules?.[scheduleTutor]?.modalities || ["online", "face-to-face"];
              const result = await s.setTutorWeeklySchedule(scheduleTutor, scheduleDays, modalities);
              setScheduleResult(result.ok
                ? { text: result.conflicts.length ? `Schedule saved. ${result.conflicts.length} affected session(s) were flagged for reassignment.` : "Tutor schedule saved and approved.", kind: result.conflicts.length ? "warn" : "success" }
                : { text: result.error, kind: "error" });
            }}>Save weekly schedule</Button>
          </div>
          {scheduleResult && <Alert kind={scheduleResult.kind}>{scheduleResult.text}</Alert>}
        </>}
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Team Schedule Overview</h2>
          <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 text-sm">
            <button className="rounded-lg px-2 py-1.5 text-slate-600 hover:bg-white" onClick={() => changeWeek(-1)}>‹ <span className="hidden sm:inline">Prev</span></button>
            <span className="px-2 font-semibold">{scheduleDateLabel(selectedWeek[0].date).replace(/, \d{4}$/, "")} – {scheduleDateLabel(selectedWeek[5].date)}</span>
            <button className="rounded-lg px-2 py-1.5 text-slate-600 hover:bg-white" onClick={() => changeWeek(1)}><span className="hidden sm:inline">Next</span> ›</button>
            {!isCurrentWeek && <button className="rounded-lg bg-brand-600 px-3 py-1.5 font-bold text-white" onClick={() => setWeekStart(mondayOf(new Date()))}>This Week</button>}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-separate border-spacing-0 text-center">
            <thead><tr className="bg-brand-600 text-white">
              <th className="rounded-tl-xl px-3 py-4 text-left">Tutor</th>
              {selectedWeek.map(({ day, date }) => <th key={day} className="px-2 py-3"><div className="text-sm font-extrabold uppercase">{day}</div><div className="mt-0.5 text-xs font-medium">{scheduleDateLabel(date)}</div></th>)}
            </tr></thead>
            <tbody>{activeTutors.map((tutor, tutorIndex) => <tr key={tutor.userId} className={tutorIndex % 2 ? "bg-blue-100" : "bg-white"}>
              <th className="px-3 py-5 text-left font-semibold">{tutor.fullName}</th>
              {selectedWeek.map(({ day }) => {
                const working = !!db.tutorSchedules?.[tutor.userId]?.days?.[day];
                const date = selectedWeek.find((item) => item.day === day)?.date;
                const dateISO = date && asISO(date);
                const onLeave = dateISO && db.leaves.some((leave) => leave.tutorId === tutor.userId && leave.status === "approved" && (leave.dates ? leave.dates.includes(dateISO) : dateISO >= leave.startDate && dateISO <= leave.endDate));
                return <td key={day} className={`px-2 py-5 text-sm font-medium ${onLeave ? "text-orange-600" : working ? "text-green-600" : "text-red-500"}`}>{onLeave ? "On Leave" : working ? "Working" : db.tutorSchedules?.[tutor.userId] ? "Day Off" : "—"}</td>;
              })}
            </tr>)}</tbody>
          </table>
          {activeTutors.length === 0 && <Empty>No active tutors found.</Empty>}
        </div>
      </section>
    </Card>}

    {tab === "leaves" && (leaves.length === 0 ? <Empty>No leave requests.</Empty> : <div className="space-y-3">
      {leaves.map((leave) => {
        const affected = db.sessions.filter((session) => session.tutorId === leave.tutorId && session.status === "scheduled" && (leave.dates ? leave.dates.includes(session.date) : session.date >= leave.startDate && session.date <= leave.endDate)).length;
        return <Card key={leave.id} className="flex flex-wrap items-center justify-between gap-3 !p-4">
          <div>
            <div className="font-extrabold">{tn(leave.tutorId)}</div>
            <div className="text-sm">{leave.dates ? leave.dates.map(fmtDate).join(", ") : `${fmtDate(leave.startDate)} → ${fmtDate(leave.endDate)}`}</div>
            <div className="text-sm text-slate-500">{leave.reason}</div>
            {leave.status === "pending" && affected > 0 && <div className="mt-1 text-xs font-bold text-coral-600">{affected} confirmed session(s) would need reassignment</div>}
          </div>
          <div className="flex items-center gap-2"><Button size="sm" variant="secondary" onClick={() => setLeaveForm(leave)}>View Leave Form</Button><Badge status={leave.status}/>{leave.status === "pending" && <>
            <Button size="sm" variant="success" onClick={() => s.decideLeave(leave.id, true)}>Approve</Button>
            <Button size="sm" variant="danger" onClick={() => s.decideLeave(leave.id, false)}>Reject</Button>
          </>}</div>
        </Card>;
      })}
    </div>)}
    <Modal open={!!leaveForm} onClose={() => setLeaveForm(null)} title="Leave Form" wide>{leaveForm && <div className="space-y-4 text-sm text-slate-700"><p>Date Submitted: <b>{leaveForm.submittedAt ? new Date(leaveForm.submittedAt).toLocaleDateString("en-PH") : "—"}</b></p><div className="rounded-2xl border-2 border-slate-300"><div className="border-b-2 border-slate-300 px-4 py-3">Employee Name: <b>{tn(leaveForm.tutorId)}</b></div><div className="space-y-3 px-4 py-4"><p>Reason for requested leave:</p><b>{leaveForm.leaveType || leaveForm.reason}</b>{leaveForm.otherReason && <p>Other: {leaveForm.otherReason}</p>}</div><div className="border-t-2 border-slate-300 px-4 py-3">Date Requested: <b>{fmtDate(leaveForm.startDate)} to {fmtDate(leaveForm.endDate)}</b></div></div><div className="grid gap-4 sm:grid-cols-2"><div className="rounded-xl border border-slate-300 p-4"><b>Note</b><p className="mt-2 min-h-16">{leaveForm.note || "—"}</p></div><div className="rounded-xl border border-slate-300 p-4"><b>Employee’s Signature</b><p className="mt-3 font-serif italic">{leaveForm.signature || tn(leaveForm.tutorId)}</p></div></div><div className="flex flex-wrap items-center justify-between gap-2"><Badge status={leaveForm.status}/>{leaveForm.status === "pending" && <div className="flex gap-2"><Button variant="success" onClick={() => { s.decideLeave(leaveForm.id, true); setLeaveForm(null); }}>Approve</Button><Button variant="danger" onClick={() => { s.decideLeave(leaveForm.id, false); setLeaveForm(null); }}>Reject</Button></div>}</div></div>}</Modal>
  </>;
}
