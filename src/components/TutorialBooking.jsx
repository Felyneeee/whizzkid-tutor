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
  const [selectedDays, setSelectedDays] = useState([]);
  const [weeks, setWeeks] = useState(null);
  const [firstWeekStart, setFirstWeekStart] = useState("");
  const [times, setTimes] = useState({});
  const [subjects, setSubjects] = useState({});
  const [slotCounts, setSlotCounts] = useState({});
  const [err, setErr] = useState("");
  const [doneId, setDoneId] = useState(null);
  const days = selectedDays;
  const start = firstWeekStart;
  const end = start && weeks ? addDays(start, weeks * 7 - 1) : "";
  const cycleReady = weeks !== null && !!start;
  const dates = useMemo(() => cycleReady ? expandBookingDates({ type: "recurring", days, start, end }) : [], [days, start, end, cycleReady]);
  const orderedDates = [...dates].sort();
  const firstDate = orderedDates[0] || "";
  const lastDate = orderedDates[orderedDates.length - 1] || "";
  const rate = computeRate(params.program, params.gradeLevel, params.modality);
  const selectedSubjects = isAcademic ? (params.subjects || [params.subject]) : ["Reading"];
  const byDay = (day) => dates.filter((date) => weekday(date) === day);
  const slotKey = (day, index) => `${day}-${index}`;
  const slotCount = (day) => slotCounts[day] || 1;
  const weeklySlotCount = days.reduce((sum, day) => sum + slotCount(day), 0);
  const subjectForSlot = (day, index) => subjects[slotKey(day, index)] || selectedSubjects[0];
  const subjectCountForOtherSlots = (subject, day, index) => {
    let count = 0;
    for (const otherDay of days) {
      for (let otherIndex = 0; otherIndex < slotCount(otherDay); otherIndex += 1) {
        if (otherDay === day && otherIndex === index) continue;
        if (subjectForSlot(otherDay, otherIndex) === subject) count += 1;
      }
    }
    return count;
  };
  const availability = (day, index) => {
    const subject = subjectForSlot(day, index);
    const options = { program: params.program, subject, gradeLevel: params.gradeLevel, modality: params.modality, sessionType: params.sessionType };
    return HOURS.filter((time) => byDay(day).every((date) => {
      const dow = weekday(date);
      if (dow === 0 || ([1, 3, 5].includes(dow) && ["10:00", "10:45"].includes(time))) return false;
      return slotRequestable(s.db, date, time, options);
    }) && Array.from({ length: slotCount(day) }, (_, other) => other).filter((other) => other !== index).every((other) => times[slotKey(day, other)] !== time));
  };
  const weeklySubjectCounts = days.reduce((counts, day) => { Array.from({ length: slotCount(day) }, (_, index) => subjectForSlot(day, index)).forEach((subject) => { counts[subject] = (counts[subject] || 0) + 1; }); return counts; }, {});
  const subjectLimitOk = !isAcademic || Object.values(weeklySubjectCounts).every((count) => count <= 2);
  const sessionSlots = days.flatMap((day) => Array.from({ length: slotCount(day) }, (_, index) => byDay(day).map((date) => ({ seriesKey: slotKey(day, index), day, date, time: times[slotKey(day, index)], subject: subjectForSlot(day, index) })))).flat();
  const noAvailabilityDays = days.filter((day) => Array.from({ length: slotCount(day) }, (_, index) => availability(day, index).length === 0).some(Boolean));
  const hasUnavailableSelectedTime = days.some((day) => Array.from({ length: slotCount(day) }, (_, index) => {
    const time = times[slotKey(day, index)];
    return time && !availability(day, index).includes(time);
  }).some(Boolean));
  const hasMissingTime = sessionSlots.some((slot) => !slot.time);
  const ready = weeks !== null && !!start && days.length >= 1 && days.length <= 5 && weeklySlotCount <= 5
    && dates.length === days.length * weeks && !hasMissingTime && !hasUnavailableSelectedTime && subjectLimitOk;
  const bookingBlockers = [];
  if (weeks === null) bookingBlockers.push("Choose a cycle length.");
  else if (!start) bookingBlockers.push("Select a day on the calendar to set the first week.");
  if (start && days.length === 0) bookingBlockers.push("Select at least one weekday on the calendar.");
  if (days.length > 5 || weeklySlotCount > 5) bookingBlockers.push("Choose no more than five sessions per week.");
  if (weeks !== null && start && dates.length !== days.length * weeks) bookingBlockers.push("The selected dates do not cover the full cycle.");
  if (!subjectLimitOk) bookingBlockers.push("Choose each subject no more than twice per week.");
  if (noAvailabilityDays.length) bookingBlockers.push(`No times are available for ${noAvailabilityDays.map((day) => ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][day]).join(", ")} across this cycle. Change the cycle or selected weekdays.`);
  else if (hasUnavailableSelectedTime) bookingBlockers.push("A saved time is no longer available for this cycle. Select another available time.");
  if (hasMissingTime && !noAvailabilityDays.length) bookingBlockers.push("Choose an available time for every selected session.");
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
  const toggleDay = (date) => {
    const day = weekday(date);
    if (selectedDays.includes(day)) {
      const nextDays = selectedDays.filter((selectedDay) => selectedDay !== day);
      setSelectedDays(nextDays);
      if (!nextDays.length) setFirstWeekStart("");
    } else {
      if (!firstWeekStart) setFirstWeekStart(addDays(date, -day));
      setSelectedDays([...selectedDays, day]);
    }
  };
  return <div className="space-y-5">
    <Card><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-extrabold">{isAcademic ? "Academic Tutorials" : "Reading Program"}</h2><Badge status={params.modality}/><span className="text-sm text-slate-500">{params.gradeLevel}</span><span className="ml-auto rounded-xl bg-mint-50 px-3 py-1 text-sm font-extrabold text-mint-600">{peso(rate)} / session</span></div><p className="mt-2 text-sm">Subject{selectedSubjects.length > 1 ? "s" : ""}: {selectedSubjects.join(", ")}</p>{onBack && <button onClick={onBack} className="mt-2 text-xs font-bold text-brand-600">← Change details</button>}</Card>
    <Card className="space-y-4"><h3 className="font-extrabold">Choose your schedule</h3>
      <Field label="Cycle length"><div className="flex flex-wrap gap-2">{[2,3,4].map((n) => <button key={n} type="button" onClick={() => setWeeks(n)} className={cn("rounded-xl border px-4 py-2 text-sm font-bold", weeks === n ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200")}>{n === 4 ? "Month-long (4 weeks)" : `${n}-week cycle`}</button>)}</div>{weeks === null && <p className="mt-1 text-xs text-red-600">Choose a cycle length before selecting dates.</p>}</Field>
      <div className="grid gap-4 md:grid-cols-2">
        <Calendar selected={dates} onSelect={toggleDay} isDisabled={(date) => weeks === null || date < todayISO() || weekday(date) === 0 || (start && (date < start || date > end))} mark={(date) => weeks !== null && weekday(date) !== 0 && (!start || (date >= start && date <= end)) && calMarks(date) ? { text: "open", tone: "mint" } : null}/>
        <div className="space-y-4">
          <Field label="First day"><Input type="date" value={firstDate} readOnly/>{weeks !== null && !firstDate && <p className="mt-1 text-xs text-red-600">Select a weekday on the calendar to set the first day.</p>}</Field>
          <Field label="Last day"><Input type="date" value={lastDate} readOnly/>{weeks !== null && !lastDate && <p className="mt-1 text-xs text-red-600">The last day will appear after you select a weekday.</p>}</Field>
          {weeks === null && <p className="text-sm text-slate-500">Choose a cycle length, then select weekdays on the calendar.</p>}
          {weeks !== null && !start && <p className="text-sm text-slate-500">Select a date on the calendar to set the first week.</p>}
          {cycleReady && <p className="text-sm text-slate-500">Select weekdays on the calendar. Each selected weekday will repeat every week of the cycle.</p>}
          {days.length >= 1 && !subjectLimitOk && <Alert kind="warn">Choose each subject no more than twice per week.</Alert>}
        </div>
      </div>
    </Card>
    {days.map((day) => <Card key={day} className="space-y-3">
      <div className="flex items-center justify-between"><h3 className="font-extrabold">{["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][day]}</h3>{isAcademic && slotCount(day) === 1 && weeklySlotCount < 5 ? <Button size="sm" variant="secondary" onClick={() => setSlotCounts((old) => ({ ...old, [day]: 2 }))}>Add second session</Button> : isAcademic && slotCount(day) === 2 ? <Button size="sm" variant="secondary" onClick={() => { setSlotCounts((old) => ({ ...old, [day]: 1 })); setTimes((old) => { const next = { ...old }; delete next[slotKey(day, 1)]; return next; }); setSubjects((old) => { const next = { ...old }; delete next[slotKey(day, 1)]; return next; }); }}>Remove second session</Button> : null}</div>
      {Array.from({ length: slotCount(day) }, (_, index) => {
        const key = slotKey(day, index);
        const availableTimes = availability(day, index);
        const selectedTime = times[key];
        const selectedTimeUnavailable = selectedTime && !availableTimes.includes(selectedTime);
        const hasSubjectAtLimit = selectedSubjects.some((subject) => subjectCountForOtherSlots(subject, day, index) >= 2);
        return <div key={key} className="space-y-2 rounded-xl bg-slate-50 p-3">
          <Field label="Subject">
            <select value={subjectForSlot(day, index)} onChange={(e) => setSubjects((old) => ({ ...old, [key]: e.target.value }))} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2">
              {selectedSubjects.map((subject) => <option key={subject} value={subject} disabled={isAcademic && subject !== subjectForSlot(day, index) && subjectCountForOtherSlots(subject, day, index) >= 2}>{subject}</option>)}
            </select>
            {isAcademic && hasSubjectAtLimit && <p className="mt-1 text-xs text-red-600">A subject already used in two other weekly sessions can’t be selected here.</p>}
          </Field>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{availableTimes.map((time) => <button key={time} type="button" onClick={() => setTimes((old) => ({ ...old, [key]: time }))} className={cn("rounded-xl border p-2 text-sm font-bold", selectedTime === time ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200")}>{fmtTime(time)}</button>)}</div>
          {!availableTimes.length ? <p className="text-xs text-red-600">No times are available for this session across the selected cycle.</p> : selectedTimeUnavailable ? <p className="text-xs text-red-600">The saved time is no longer available. Choose another time.</p> : !selectedTime && <p className="text-xs text-red-600">Select an available time for this session.</p>}
        </div>;
      })}
    </Card>)}
    <Card className="space-y-3">
      <h3 className="font-extrabold">Booking summary</h3>
      {sessionSlots.length ? sessionSlots.map((slot) => <div key={`${slot.seriesKey}-${slot.date}`} className="flex justify-between text-sm"><span>{fmtDate(slot.date)} · {slot.subject}</span><span>{slot.time ? fmtTime(slot.time) : "Time not selected"}</span></div>) : <p className="text-sm text-slate-600">No sessions selected yet.</p>}
      {sessionSlots.length > 0 && <p className="font-bold">{sessionSlots.length} sessions × {peso(rate)} = {peso(rate * sessionSlots.length)}</p>}
      {!ready && <div className="space-y-1"><h4 className="text-sm font-bold text-red-600">Why you can’t book yet</h4><ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">{bookingBlockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul></div>}
      {err && <Alert kind="error">{err}</Alert>}
      <Button onClick={submit} disabled={!ready}>Submit booking request</Button>
    </Card>
  </div>;
}
