"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Calendar } from "@/components/Calendar";
import { Alert, Badge, Button, Card, Field, Input, cn, peso } from "@/components/ui";
import { addDays, fmtDate, fmtTime, todayISO, weekday } from "@/lib/dates";
import { HOURS } from "@/lib/constants";
import { computeRate, expandBookingDates, slotRequestable } from "@/lib/logic";
import { useStore } from "@/lib/store";

export function TutorialBooking({ params, tuteeId, onBack }) {
  const s = useStore();
  const refreshSlotAvailability = s.refreshSlotAvailability;
  const isAcademic = params.program === "academic";
  const [selectedDays, setSelectedDays] = useState([]);
  const [weeks, setWeeks] = useState(null);
  const [firstWeekStart, setFirstWeekStart] = useState("");
  const [times, setTimes] = useState({});
  const [serverAvailability, setServerAvailability] = useState(null);
  const [unavailableDateTimes, setUnavailableDateTimes] = useState([]);
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
  const selectedSubjects = useMemo(() => isAcademic ? (params.subjects || [params.subject]) : ["Reading"], [isAcademic, params.subjects, params.subject]);
  useEffect(() => {
    if (!cycleReady || !dates.length) {
      setServerAvailability(null);
      return undefined;
    }
    let stopped = false;
    let inFlight = false;
    const refresh = async () => {
      if (stopped || inFlight || document.visibilityState !== "visible") return;
      inFlight = true;
      const result = await refreshSlotAvailability({
        dates, times: HOURS, subjects: selectedSubjects, program: params.program,
        gradeLevel: params.gradeLevel, modality: params.modality,
        sessionType: params.sessionType || "one-on-one",
      });
      inFlight = false;
      if (!stopped && result.ok) setServerAvailability(result.available);
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [cycleReady, dates, selectedSubjects, params.program, params.gradeLevel, params.modality, params.sessionType, refreshSlotAvailability]);
  const byDay = useCallback((day) => dates.filter((date) => weekday(date) === day), [dates]);
  const slotKey = useCallback((day, index) => `${day}-${index}`, []);
  const slotCount = useCallback((day) => slotCounts[day] || 1, [slotCounts]);
  const weeklySlotCount = days.reduce((sum, day) => sum + slotCount(day), 0);
  const subjectForSlot = useCallback((day, index) => subjects[slotKey(day, index)] || selectedSubjects[0], [slotKey, subjects, selectedSubjects]);
  const subjectCountForOtherSlots = (subject, day, index) => {
    let count = 0;
    for (let otherIndex = 0; otherIndex < slotCount(day); otherIndex += 1) {
      if (otherIndex === index) continue;
      if (subjectForSlot(day, otherIndex) === subject) count += 1;
    }
    return count;
  };
  const weekdayAvailability = useMemo(() => {
    const available = {};
    if (!cycleReady) return available;
    for (const day of [1, 2, 3, 4, 5, 6]) {
      const recurringDates = expandBookingDates({ type: "recurring", days: [day], start, end });
      available[day] = recurringDates.length > 0 && selectedSubjects.some((subject) =>
        HOURS.some((time) => recurringDates.every((date) => {
          const dow = weekday(date);
          if (dow === 0 || ([1, 3, 5].includes(dow) && ["10:00", "10:45"].includes(time))) return false;
          return slotRequestable(s.db, date, time, { program: params.program, subject, gradeLevel: params.gradeLevel, modality: params.modality, sessionType: params.sessionType });
        })),
      );
    }
    return available;
  }, [cycleReady, start, end, s.db, selectedSubjects, params.program, params.gradeLevel, params.modality, params.sessionType]);
  const availability = useCallback((day, index) => {
    const subject = subjectForSlot(day, index);
    const options = { program: params.program, subject, gradeLevel: params.gradeLevel, modality: params.modality, sessionType: params.sessionType };
    return HOURS.filter((time) => byDay(day).every((date) => {
      if (unavailableDateTimes.includes(`${slotKey(day, index)}-${time}-${subject}`)) return false;
      if (unavailableDateTimes.includes(`${date}-${time}-${subject}`)) return false;
      const dow = weekday(date);
      if (dow === 0 || ([1, 3, 5].includes(dow) && ["10:00", "10:45"].includes(time))) return false;
      const availabilityKey = `${date}|${time}|${subject}`;
      return serverAvailability && Object.hasOwn(serverAvailability, availabilityKey)
        ? serverAvailability[availabilityKey]
        : slotRequestable(s.db, date, time, options);
    }) && Array.from({ length: slotCount(day) }, (_, other) => other).filter((other) => other !== index).every((other) => times[slotKey(day, other)] !== time));
  }, [byDay, slotCount, times, unavailableDateTimes, subjectForSlot, serverAvailability, s.db, params.program, params.gradeLevel, params.modality, params.sessionType, slotKey]);
  useEffect(() => {
    const staleKeys = days.flatMap((day) => Array.from({ length: slotCount(day) }, (_, index) => {
      const key = slotKey(day, index);
      const selectedTime = times[key];
      return selectedTime && !availability(day, index).includes(selectedTime) ? [key] : [];
    }));
    if (!staleKeys.length) return;
    setTimes((current) => {
      const next = { ...current };
      staleKeys.forEach((key) => delete next[key]);
      return next;
    });
  }, [availability, days, slotCount, times, slotKey]);
  const dailySubjectLimitOk = days.every((day) => {
    const counts = Array.from({ length: slotCount(day) }, (_, index) => subjectForSlot(day, index)).reduce((all, subject) => ({ ...all, [subject]: (all[subject] || 0) + 1 }), {});
    return Object.values(counts).every((count) => count <= 2);
  });
  const scheduledSubjects = days.map((day) => Array.from({ length: slotCount(day) }, (_, index) => subjectForSlot(day, index))).flat();
  const missingSubjects = isAcademic ? selectedSubjects.filter((subject) => !scheduledSubjects.includes(subject)) : [];
  const subjectLimitOk = !isAcademic || dailySubjectLimitOk;
  const sessionSlots = days.flatMap((day) => Array.from({ length: slotCount(day) }, (_, index) => byDay(day).map((date) => ({ seriesKey: slotKey(day, index), day, date, time: times[slotKey(day, index)], subject: subjectForSlot(day, index) })))).flat();
  const noAvailabilityDays = days.filter((day) => Array.from({ length: slotCount(day) }, (_, index) => availability(day, index).length === 0).some(Boolean));
  const hasUnavailableSelectedTime = days.some((day) => Array.from({ length: slotCount(day) }, (_, index) => {
    const time = times[slotKey(day, index)];
    return time && !availability(day, index).includes(time);
  }).some(Boolean));
  const hasMissingTime = sessionSlots.some((slot) => !slot.time);
  const ready = weeks !== null && !!start && days.length >= 1 && days.length <= 6 && weeklySlotCount >= 1 && weeklySlotCount <= 18 && selectedSubjects.length <= 5
    && dates.length === days.length * weeks && !hasMissingTime && !hasUnavailableSelectedTime && subjectLimitOk && missingSubjects.length === 0;
  const bookingBlockers = [];
  if (weeks === null) bookingBlockers.push("Choose a cycle length.");
  else if (!start) bookingBlockers.push("Select a day on the calendar to set the first week.");
  if (start && days.length === 0) bookingBlockers.push("Select at least one weekday on the calendar.");
  if (weeklySlotCount > 18) bookingBlockers.push("Choose no more than 18 sessions per week.");
  if (selectedSubjects.length > 5) bookingBlockers.push("Choose no more than five subjects per request.");
  if (weeks !== null && start && dates.length !== days.length * weeks) bookingBlockers.push("The selected dates do not cover the full cycle.");
  if (!subjectLimitOk) bookingBlockers.push("Choose each subject no more than twice per day.");
  if (missingSubjects.length) bookingBlockers.push(`${missingSubjects.join(" and ")} still ${missingSubjects.length === 1 ? "needs" : "need"} a schedule. Add another session and assign ${missingSubjects.length === 1 ? "it" : "them"} before booking.`);
  if (noAvailabilityDays.length) bookingBlockers.push(`No times are available for ${noAvailabilityDays.map((day) => ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][day]).join(", ")} across this cycle. Change the cycle or selected weekdays.`);
  else if (hasMissingTime) bookingBlockers.push("Choose an available time for every selected session.");
  else if (hasUnavailableSelectedTime) bookingBlockers.push("A saved time is no longer available for this cycle. Select another available time.");
  if (doneId) return <Card className="text-center"><CheckCircle2 className="mx-auto h-12 w-12 text-mint-500"/><h2 className="mt-2 text-xl font-extrabold">Booking request submitted!</h2><div className="mt-4 flex justify-center gap-2"><Link href="/tutee/requests"><Button>View pending requests</Button></Link><Link href="/tutee"><Button variant="secondary">Back to overview</Button></Link></div></Card>;
  const submit = async () => {
    setErr("");
    const sessionTimes = Object.fromEntries(dates.map((date) => [date, sessionSlots.find((slot) => slot.date === date)?.time]));
    const sessionSubjects = Object.fromEntries(dates.map((date) => [date, sessionSlots.find((slot) => slot.date === date)?.subject]));
    const r = await s.submitTutorialBooking({ tuteeId, program: params.program, subject: selectedSubjects[0], subjects: selectedSubjects, gradeLevel: params.gradeLevel, modality: params.modality, learningNeeds: params.learningNeeds, bookingType: "recurring", sessionType: params.sessionType || "one-on-one", dates, time: sessionTimes[dates[0]], sessionTimes, sessionSubjects, sessionSlots, recurrence: { days, start, end, cycleWeeks: weeks }, cycleType: weeks === 4 ? "1-month" : `${weeks}-week`, cycleStart: start, cycleEnd: end, cycleSessionAllowance: sessionSlots.length, assessmentId: params.assessmentId });
    if (!r.ok) {
      if (Array.isArray(r.unavailableDates) && r.unavailableDates.length) {
        const unavailableDates = new Set(r.unavailableDates);
        const unavailableSlots = sessionSlots.filter((slot) => slot.time && unavailableDates.has(slot.date));
        if (unavailableSlots.length) {
          setUnavailableDateTimes((old) => [...new Set([...old, ...unavailableSlots.flatMap((slot) => [`${slot.date}-${slot.time}-${slot.subject}`, `${slot.seriesKey}-${slot.time}-${slot.subject}`])])]);
          const affectedSeries = new Set(unavailableSlots.map((slot) => slot.seriesKey));
          setTimes((old) => {
            const next = { ...old };
            affectedSeries.forEach((key) => delete next[key]);
            return next;
          });
          return;
        }
      }
      return setErr(r.error);
    }
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
      // Anchor the cycle on the first date the user selected. Anchoring to
      // Sunday would make a Wednesday selection start the cycle on Sunday.
      if (!firstWeekStart) setFirstWeekStart(date);
      setSelectedDays([...selectedDays, day]);
    }
  };
  const resetSchedule = () => {
    setSelectedDays([]);
    setWeeks(null);
    setFirstWeekStart("");
    setTimes({});
    setUnavailableDateTimes([]);
    setSubjects({});
    setSlotCounts({});
    setErr("");
  };
  const calendarDateAvailable = (date) => {
    if (cycleReady) return !!weekdayAvailability[weekday(date)];
    if (weeks === null) return false;
    return selectedSubjects.some((subject) => HOURS.some((time) => {
      const day = weekday(date);
      if (day === 0 || ([1, 3, 5].includes(day) && ["10:00", "10:45"].includes(time))) return false;
      return slotRequestable(s.db, date, time, { program: params.program, subject, gradeLevel: params.gradeLevel, modality: params.modality, sessionType: params.sessionType });
    }));
  };
  return <div className="space-y-5">
    <Card><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-extrabold">{isAcademic ? "Academic Tutorials" : "Reading Program"}</h2><Badge status={params.modality}/><span className="text-sm text-slate-500">{params.gradeLevel}</span><span className="ml-auto rounded-xl bg-mint-50 px-3 py-1 text-sm font-extrabold text-mint-600">{peso(rate)} / session</span></div><p className="mt-2 text-sm">Subject{selectedSubjects.length > 1 ? "s" : ""}: {selectedSubjects.join(", ")}</p>{onBack && <button onClick={onBack} className="mt-2 text-xs font-bold text-brand-600">← Change details</button>}</Card>
    <Card className="space-y-5 p-5 sm:p-6"><h3 className="text-lg font-extrabold">Choose your schedule</h3>
      <Field label="Cycle length"><div className="flex flex-wrap gap-2">{[2,3,4].map((n) => <button key={n} type="button" onClick={() => setWeeks(n)} className={cn("rounded-xl border px-4 py-2 text-sm font-bold", weeks === n ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200")}>{n === 4 ? "Month-long (4 weeks)" : `${n}-week cycle`}</button>)}</div>{weeks === null && <p className="mt-1 text-xs text-red-600">Choose a cycle length before selecting dates.</p>}</Field>
      <div className="grid gap-5 md:grid-cols-2 md:items-stretch">
        <Calendar selected={dates} onSelect={toggleDay} isDisabled={(date) => {
          const day = weekday(date);
          const selected = selectedDays.includes(day);
          return weeks === null || date < todayISO() || day === 0 || (start && (date < start || date > end)) || (!selected && !calendarDateAvailable(date));
        }} mark={(date) => weeks !== null && weekday(date) !== 0 && (!start || (date >= start && date <= end)) && calendarDateAvailable(date) ? { text: "open", tone: "mint" } : null}/>
        <div className="space-y-4">
          <Field label="First day"><Input type="date" value={firstDate} readOnly/>{weeks !== null && !firstDate && <p className="mt-1 text-xs text-red-600">Select a weekday on the calendar to set the first day.</p>}</Field>
          <Field label="Last day"><Input type="date" value={lastDate} readOnly/>{weeks !== null && !lastDate && <p className="mt-1 text-xs text-red-600">The last day will appear after you select a weekday.</p>}</Field>
          {weeks === null && <p className="text-sm text-slate-500">Choose a cycle length, then select weekdays on the calendar.</p>}
          {weeks !== null && !start && <p className="text-sm text-slate-500">Select a date on the calendar to set the first week.</p>}
          {cycleReady && <p className="text-sm text-slate-500">Select weekdays on the calendar. Each selected weekday will repeat every week of the cycle.</p>}
          {days.length >= 1 && !subjectLimitOk && <Alert kind="warn">Choose each subject no more than twice per day.</Alert>}
          <Button variant="danger" onClick={resetSchedule}>Reset schedule</Button>
        </div>
      </div>
    </Card>
    {days.length > 0 && <div className="grid gap-4 md:grid-cols-2">{days.map((day) => <Card key={day} className="space-y-3 p-5">
      <div className="flex items-center justify-between"><h3 className="font-extrabold">{["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][day]}</h3>{isAcademic && slotCount(day) < 3 && weeklySlotCount < 18 ? <Button size="sm" variant="secondary" onClick={() => setSlotCounts((old) => ({ ...old, [day]: slotCount(day) + 1 }))}>Add session</Button> : null}{isAcademic && slotCount(day) > 1 ? <Button size="sm" variant="secondary" onClick={() => { const removeIndex = slotCount(day) - 1; setSlotCounts((old) => ({ ...old, [day]: removeIndex })); setTimes((old) => { const next = { ...old }; delete next[slotKey(day, removeIndex)]; return next; }); setSubjects((old) => { const next = { ...old }; delete next[slotKey(day, removeIndex)]; return next; }); }}>Remove session</Button> : null}</div>
      {Array.from({ length: slotCount(day) }, (_, index) => {
        const key = slotKey(day, index);
        const availableTimes = availability(day, index);
        const selectedTime = times[key];
        const hasSubjectAtLimit = selectedSubjects.some((subject) => subjectCountForOtherSlots(subject, day, index) >= 2);
        return <div key={key} className="space-y-3 rounded-2xl bg-slate-50 p-4">
          <Field label="Subject">
            <select value={subjectForSlot(day, index)} onChange={(e) => { setSubjects((old) => ({ ...old, [key]: e.target.value })); }} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100">
              {selectedSubjects.map((subject) => <option key={subject} value={subject} disabled={isAcademic && subject !== subjectForSlot(day, index) && subjectCountForOtherSlots(subject, day, index) >= 2}>{subject}</option>)}
            </select>
            {isAcademic && hasSubjectAtLimit && <p className="mt-1 text-xs text-red-600">A subject already used in two other sessions that day can’t be selected here.</p>}
          </Field>
          <select value={selectedTime || ""} onChange={(e) => { setTimes((old) => ({ ...old, [key]: e.target.value })); }} disabled={!availableTimes.length} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400">
            <option value="">{availableTimes.length ? "Please select an available time" : "No available times"}</option>
            {availableTimes.map((time) => <option key={time} value={time}>{fmtTime(time)}</option>)}
          </select>
          {!availableTimes.length ? <p className="text-xs text-red-600">No times are available for this session across the selected cycle.</p> : !selectedTime && <p className="text-xs text-slate-500">Select an available time for this session.</p>}
        </div>;
      })}
    </Card>)}</div>}
    {isAcademic && <Alert kind="warn">Limits: 3 sessions per day, 18 per week, and 2 sessions for the same subject per day. Choose up to 5 subjects and at least 1 session.</Alert>}
    <Card className="space-y-3 p-5 sm:p-6">
      <h3 className="font-extrabold">Booking summary</h3>
      {isAcademic && selectedSubjects.length > 1 && (missingSubjects.length ? <Alert kind="warn">Would you like to proceed with booking? {missingSubjects.join(" and ")} still {missingSubjects.length === 1 ? "needs" : "need"} a schedule, since you selected {selectedSubjects.join(" and ")}. Please add {missingSubjects.length === 1 ? "a" : "the required"} session{missingSubjects.length === 1 ? "" : "s"} and assign {missingSubjects.length === 1 ? "it" : "each subject"} before continuing.</Alert> : <Alert kind="success">All selected subjects are included in your schedule: {selectedSubjects.join(", ")}.</Alert>)}
      {sessionSlots.length ? sessionSlots.map((slot) => <div key={`${slot.seriesKey}-${slot.date}`} className="flex justify-between text-sm"><span>{fmtDate(slot.date)} · {slot.subject}</span><span>{slot.time ? fmtTime(slot.time) : "Time not selected"}</span></div>) : <p className="text-sm text-slate-600">No sessions selected yet.</p>}
      {sessionSlots.length > 0 && <p className="font-bold">{sessionSlots.length} sessions × {peso(rate)} = {peso(rate * sessionSlots.length)}</p>}
      {!ready && <div className="space-y-1 text-sm text-red-600">{bookingBlockers.map((blocker) => <p key={blocker}>{blocker}</p>)}</div>}
      {err && <Alert kind="error">{err}</Alert>}
      <Button onClick={submit} disabled={!ready}>Submit booking request</Button>
    </Card>
  </div>;
}
