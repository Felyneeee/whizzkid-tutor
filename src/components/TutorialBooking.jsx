"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Calendar } from "@/components/Calendar";
import { Alert, Badge, Button, Card, Field, Input, cn, peso } from "@/components/ui";
import { addDays, fmtDate, fmtTime, todayISO, weekday } from "@/lib/dates";
import { HOURS } from "@/lib/constants";
import { computeRate, expandBookingDates, slotRequestable } from "@/lib/logic";
import { useStore } from "@/lib/store";

export function TutorialBooking({ params, tuteeId, onBack }) {
  const s = useStore();
  const isAcademic = params.program === "academic";
  const [selectedDates, setSelectedDates] = useState([]);
  const [weeks, setWeeks] = useState(2);
  const [times, setTimes] = useState({});
  const [subjects, setSubjects] = useState({});
  const [slotCounts, setSlotCounts] = useState({});
  const [err, setErr] = useState("");
  const [doneId, setDoneId] = useState(null);
  const days = useMemo(() => [...new Set(selectedDates.map(weekday))], [selectedDates]);
  const start = selectedDates.length ? [...selectedDates].sort()[0] : "";
  const end = start ? addDays(start, weeks * 7 - 1) : "";
  const dates = useMemo(() => start ? expandBookingDates({ type: "recurring", days, start, end }) : [], [days, start, end]);
  const rate = computeRate(params.program, params.gradeLevel, params.modality);
  const selectedSubjects = isAcademic ? (params.subjects || [params.subject]) : ["Reading"];
  const byDay = (day) => dates.filter((date) => weekday(date) === day);
  const slotKey = (day, index) => `${day}-${index}`;
  const slotCount = (day) => slotCounts[day] || 1;
  const weeklySlotCount = days.reduce((sum, day) => sum + slotCount(day), 0);
  const availability = (day, index) => {
    const subject = subjects[slotKey(day, index)] || params.subjects?.[0] || params.subject;
    const options = { program: params.program, subject, gradeLevel: params.gradeLevel, modality: params.modality, sessionType: params.sessionType };
    return HOURS.filter((time) => byDay(day).every((date) => {
      const dow = weekday(date);
      if (dow === 0 || ([1, 3, 5].includes(dow) && ["10:00", "10:45"].includes(time))) return false;
      return slotRequestable(s.db, date, time, options);
    }) && Array.from({ length: slotCount(day) }, (_, other) => other).filter((other) => other !== index).every((other) => times[slotKey(day, other)] !== time));
  };
  const weeklySubjectCounts = days.reduce((counts, day) => { Array.from({ length: slotCount(day) }, (_, index) => subjects[slotKey(day, index)] || params.subjects?.[0] || params.subject).forEach((subject) => { counts[subject] = (counts[subject] || 0) + 1; }); return counts; }, {});
  const subjectLimitOk = !isAcademic || Object.values(weeklySubjectCounts).every((count) => count <= 2);
  const sessionSlots = days.flatMap((day) => Array.from({ length: slotCount(day) }, (_, index) => byDay(day).map((date) => ({ seriesKey: slotKey(day, index), day, date, time: times[slotKey(day, index)], subject: subjects[slotKey(day, index)] || params.subjects?.[0] || params.subject })))).flat();
  const ready = days.length >= 1 && days.length <= 5 && weeklySlotCount <= 5 && dates.length === days.length * weeks && sessionSlots.every((slot) => slot.time) && subjectLimitOk;
  if (doneId) return <Card className="text-center"><CheckCircle2 className="mx-auto h-12 w-12 text-mint-500"/><h2 className="mt-2 text-xl font-extrabold">Booking request submitted!</h2><div className="mt-4 flex justify-center gap-2"><Link href="/tutee/requests"><Button>View pending requests</Button></Link><Link href="/tutee"><Button variant="secondary">Back to overview</Button></Link></div></Card>;
  const submit = async () => {
    setErr("");
    const sessionTimes = Object.fromEntries(dates.map((date) => [date, sessionSlots.find((slot) => slot.date === date)?.time]));
    const sessionSubjects = Object.fromEntries(dates.map((date) => [date, sessionSlots.find((slot) => slot.date === date)?.subject]));
    const r = await s.submitTutorialBooking({ tuteeId, program: params.program, subject: selectedSubjects[0], subjects: selectedSubjects, gradeLevel: params.gradeLevel, modality: params.modality, learningNeeds: params.learningNeeds, bookingType: "recurring", sessionType: params.sessionType || "one-on-one", dates, time: sessionTimes[dates[0]], sessionTimes, sessionSubjects, sessionSlots, recurrence: { days, start, end, cycleWeeks: weeks }, cycleType: weeks === 4 ? "1-month" : `${weeks}-week`, cycleStart: start, cycleEnd: end, cycleSessionAllowance: sessionSlots.length, assessmentId: params.assessmentId });
    if (!r.ok) return setErr(r.error);
    setDoneId(r.bookingId);
  };
  const calMarks = () => true;
  return <div className="space-y-5">
    <Card><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-extrabold">{isAcademic ? "Academic Tutorials" : "Reading Program"}</h2><Badge status={params.modality}/><span className="text-sm text-slate-500">{params.gradeLevel}</span><span className="ml-auto rounded-xl bg-mint-50 px-3 py-1 text-sm font-extrabold text-mint-600">{peso(rate)} / session</span></div><p className="mt-2 text-sm">Subject{selectedSubjects.length > 1 ? "s" : ""}: {selectedSubjects.join(", ")}</p>{onBack && <button onClick={onBack} className="mt-2 text-xs font-bold text-brand-600">← Change details</button>}</Card>
    <Card className="space-y-4"><h3 className="font-extrabold">Choose your schedule</h3>
      <Field label="Cycle length"><div className="flex flex-wrap gap-2">{[2,3,4].map((n) => <button key={n} type="button" onClick={() => { setWeeks(n); setTimes({}); }} className={cn("rounded-xl border px-4 py-2 text-sm font-bold", weeks === n ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200")}>{n === 4 ? "Month-long (4 weeks)" : `${n}-week cycle`}</button>)}</div></Field>
      <div className="grid gap-4 md:grid-cols-2"><Calendar selected={selectedDates} onSelect={(date) => { setSelectedDates((old) => old.some((d) => weekday(d) === weekday(date)) ? old.filter((d) => weekday(d) !== weekday(date)) : old.length >= 5 ? old : [...old, date]); setTimes({}); }} isDisabled={(date) => date < todayISO() || weekday(date) === 0} mark={(date) => weekday(date) !== 0 && calMarks(date) ? { text: "open", tone: "mint" } : null}/>
      <div className="space-y-2"><Field label="First week starts"><Input type="date" min={todayISO()} value={start} onChange={(e) => { setSelectedDates(e.target.value ? [e.target.value, ...selectedDates.filter((d) => weekday(d) !== weekday(e.target.value))].slice(0, 5) : []); setTimes({}); }}/></Field>{days.length >= 1 && !subjectLimitOk && <Alert kind="warn">Choose each subject no more than twice per week.</Alert>}</div></div>
    </Card>
    {days.map((day) => <Card key={day} className="space-y-3"><div className="flex items-center justify-between"><h3 className="font-extrabold">{["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][day]}</h3>{isAcademic && slotCount(day) === 1 && weeklySlotCount < 5 ? <Button size="sm" variant="secondary" onClick={() => setSlotCounts((old) => ({ ...old, [day]: 2 }))}>Add second session</Button> : isAcademic && slotCount(day) === 2 ? <Button size="sm" variant="secondary" onClick={() => { setSlotCounts((old) => ({ ...old, [day]: 1 })); setTimes((old) => { const next = { ...old }; delete next[slotKey(day, 1)]; return next; }); setSubjects((old) => { const next = { ...old }; delete next[slotKey(day, 1)]; return next; }); }}>Remove second session</Button> : null}</div>{Array.from({ length: slotCount(day) }, (_, index) => <div key={slotKey(day, index)} className="space-y-2 rounded-xl bg-slate-50 p-3"><Field label="Subject"><select value={subjects[slotKey(day, index)] || selectedSubjects[0]} onChange={(e) => { setSubjects((old) => ({ ...old, [slotKey(day, index)]: e.target.value })); setTimes((old) => ({ ...old, [slotKey(day, index)]: "" })); }} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2">{selectedSubjects.map((subject) => <option key={subject}>{subject}</option>)}</select></Field><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{availability(day, index).map((time) => <button key={time} type="button" onClick={() => setTimes((old) => ({ ...old, [slotKey(day, index)]: time }))} className={cn("rounded-xl border p-2 text-sm font-bold", times[slotKey(day, index)] === time ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200")}>{fmtTime(time)}</button>)}{availability(day, index).length === 0 && <p className="text-sm text-slate-400">No open times</p>}</div></div>)}</Card>)}
    {ready && <Card className="space-y-3"><h3 className="font-extrabold">Booking summary</h3>{sessionSlots.map((slot) => <div key={`${slot.seriesKey}-${slot.date}`} className="flex justify-between text-sm"><span>{fmtDate(slot.date)} · {slot.subject}</span><span>{fmtTime(slot.time)}</span></div>)}<p className="font-bold">{sessionSlots.length} sessions × {peso(rate)} = {peso(rate * sessionSlots.length)}</p>{err && <Alert kind="error">{err}</Alert>}<Button onClick={submit}>Submit booking request</Button></Card>}
  </div>;
}
