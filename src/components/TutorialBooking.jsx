"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Repeat } from "lucide-react";
import { Calendar } from "@/components/Calendar";
import { Alert, Badge, Button, Card, Field, Input, cn, peso } from "@/components/ui";
import { addDays, fmtDate, fmtTime, todayISO, weekday } from "@/lib/dates";
import { HOURS } from "@/lib/constants";
import { computeRate, expandBookingDates, hasOpenSlot, matchTutors, remainingCapacity, slotOccupied, timesForDate } from "@/lib/logic";
import { useStore } from "@/lib/store";
export function TutorialBooking({ params, tuteeId, onBack }) {
    const s = useStore();
    const [selectedDates, setSelectedDates] = useState([]);
    const [repeatWeekly, setRepeatWeekly] = useState(false);
    const [repeatUntil, setRepeatUntil] = useState(addDays(todayISO(), 29));
    const [time, setTime] = useState("");
    const [err, setErr] = useState("");
    const [doneId, setDoneId] = useState(null);
    const base = useMemo(() => ({ program: params.program, subject: params.subject, gradeLevel: params.gradeLevel, modality: params.modality, sessionType: params.sessionType ?? "one-on-one" }), [params.program, params.subject, params.gradeLevel, params.modality, params.sessionType]);
    const rate = computeRate(params.program, params.gradeLevel, params.modality);
    const dates = useMemo(() => {
        if (!selectedDates.length)
            return [];
        if (repeatWeekly) {
            const start = selectedDates[0];
            const days = [...new Set(selectedDates.map(weekday))];
            return expandBookingDates({ type: "recurring", days, start, end: repeatUntil });
        }
        return [...selectedDates].sort();
    }, [selectedDates, repeatWeekly, repeatUntil]);
    // Time slots available (one-time: for that date; recurring: across all dates)
    const times = useMemo(() => {
        if (!dates.length)
            return [];
        if (dates.length === 1)
            return timesForDate(s.db, base, dates[0]).map((t) => ({ time: t.time, full: t.count, any: t.count, open: !slotOccupied(s.db, dates[0], t.time, undefined, undefined, base) }));
        return HOURS.filter((h) => dates.every((date) => timesForDate(s.db, base, date).some((slot) => slot.time === h))).map((h) => {
            const m = matchTutors(s.db, { ...base, dates, time: h });
            const open = dates.every((date) => !slotOccupied(s.db, date, h, undefined, undefined, base));
            return { time: h, full: m.filter((x) => x.full).length, any: Math.min(...dates.map((date) => remainingCapacity(s.db, date, h, base))), open };
        });
    }, [s.db, base, dates]);
    const matches = useMemo(() => (dates.length && time ? matchTutors(s.db, { ...base, dates, time }) : []), [s.db, base, dates, time]);
    const slotOpen = !!dates.length && !!time && dates.every((date) => !slotOccupied(s.db, date, time, undefined, undefined, base));
    const noTutors = slotOpen && matches.length === 0;
    const calMarks = useMemo(() => {
        const cache = {};
        return (d) => (cache[d] ?? (cache[d] = hasOpenSlot(s.db, d)));
    }, [s.db]);
    if (doneId) {
        const b = s.db.bookings.find((x) => x.id === doneId);
        return (<Card className="text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-mint-500"/>
        <h2 className="mt-2 text-xl font-extrabold">Booking request submitted!</h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
          Your {b.dates.length} slot(s) are temporarily reserved. {b.recommendations.length ? "Our admin will review the recommended tutors and confirm the assignment." : "We’ll match your request when a tutor with a suitable approved schedule becomes available."} You&apos;ll receive an in-app notification when the request is reviewed.
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <Link href="/tutee/requests">
            <Button>View pending requests</Button>
          </Link>
          <Link href="/tutee">
            <Button variant="secondary">Back to overview</Button>
          </Link>
        </div>
      </Card>);
    }
    const submit = async () => {
        setErr("");
        const r = await s.submitTutorialBooking({
            tuteeId,
            program: params.program,
            subject: params.subject,
            gradeLevel: params.gradeLevel,
            modality: params.modality,
            learningNeeds: params.learningNeeds,
            bookingType: dates.length > 1 ? "recurring" : "one-time",
            sessionType: params.sessionType ?? "one-on-one",
            dates,
            time,
            recurrence: repeatWeekly && dates.length ? { days: [...new Set(selectedDates.map(weekday))], start: selectedDates[0], end: repeatUntil } : undefined,
            assessmentId: params.assessmentId,
        });
        if (!r.ok)
            return setErr(r.error);
        setDoneId(r.bookingId);
    };
    const topFull = matches.find((m) => m.full);
    return (<div className="space-y-5">
      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-extrabold">{params.program === "reading" ? "Reading Program" : params.subject}</h2>
          <Badge status={params.modality}/>
          <span className="text-sm text-slate-500">{params.gradeLevel}</span>
          <span className="ml-auto rounded-xl bg-mint-50 px-3 py-1 text-sm font-extrabold text-mint-600">{peso(rate)} / hour</span>
        </div>
        {params.learningNeeds && <p className="mt-2 text-sm text-slate-500">Learning needs: {params.learningNeeds}</p>}
        {onBack && (<button onClick={onBack} className="mt-2 text-xs font-bold text-brand-600">
            ← Change details
          </button>)}
      </Card>

      <Card className="space-y-4">
        <div>
          <h3 className="font-extrabold">Pick your session dates</h3>
          <p className="mt-1 text-sm text-slate-500">Select one date or click several dates. With weekly repeat on, each selected weekday repeats until the end date. The chosen time must be open on every session date.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Calendar selected={dates} onSelect={(d) => {
            if (repeatWeekly) {
                if (repeatUntil < d)
                    setRepeatUntil(addDays(d, 28));
                const day = weekday(d);
                setSelectedDates((current) => current.some((date) => weekday(date) === day)
                    ? current.filter((date) => weekday(date) !== day)
                    : [...current, d].sort());
            }
            else {
                setSelectedDates((current) => current.includes(d) ? current.filter((x) => x !== d) : [...current, d].sort());
            }
            setTime("");
        }} isDisabled={(d) => !calMarks(d) && !dates.includes(d)} mark={(d) => (calMarks(d) ? { text: "open", tone: "mint" } : null)}/>
          <div className="space-y-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
              <input type="checkbox" checked={repeatWeekly} onChange={(e) => {
            setRepeatWeekly(e.target.checked);
            setTime("");
        }} className="h-4 w-4 accent-brand-600"/>
              Repeat weekly
              <Repeat className="h-4 w-4 text-brand-600"/>
            </label>
            {repeatWeekly && (<Field label="Repeat until">
                <Input type="date" min={selectedDates[selectedDates.length - 1] || addDays(todayISO(), 1)} value={repeatUntil} onChange={(e) => { setRepeatUntil(e.target.value); setTime(""); }}/>
              </Field>)}
            <p className="text-sm text-slate-500">
              {dates.length ? `${dates.length} session date(s): ${fmtDate(dates[0])}${dates.length > 1 ? ` – ${fmtDate(dates[dates.length - 1])}` : ""}` : "Choose at least one open date."}
            </p>
            <div>
              <p className="mb-2 text-sm font-bold">Pick an open time</p>
              <TimeGrid times={times} value={time} onChange={setTime} recurring={dates.length > 1} empty="Select one or more dates first."/>
            </div>
          </div>
        </div>
      </Card>

      {time && dates.length > 0 && (<Card>
          <h3 className="font-extrabold">Availability check</h3>
          {!slotOpen ? (<div className="mt-2">
              <Alert kind="warn">This slot is occupied now. Please choose another open time.</Alert>
            </div>) : noTutors ? (<div className="mt-2 space-y-3">
              <Alert kind="warn">
                <AlertTriangle className="mr-1 inline h-4 w-4"/>
                This slot is open, but no tutor matches it yet. You can submit the request now; the admin can match it after a tutor with a suitable approved schedule becomes available.
              </Alert>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 text-sm">
                <span>{dates.length} session(s) × {peso(rate)} = <b>{peso(rate * dates.length)}</b></span>
                <Button onClick={submit}>Submit booking request</Button>
              </div>
              {err && <Alert kind="error">{err}</Alert>}
            </div>) : (<div className="mt-2 space-y-3">
              <Alert kind="success">
                {matches.length} compatible tutor(s) found. {topFull ? "At least one can cover every session." : "No single tutor covers every date — the admin may arrange reassignment."}
              </Alert>
              <p className="text-xs text-slate-500">Only admin-approved availability counts; pending requests and approved leaves are excluded. Slots are held temporarily once you submit, then the admin reviews and confirms the tutor.</p>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 text-sm">
                <span>
                  {dates.length} session(s) × {peso(rate)} = <b>{peso(rate * dates.length)}</b>
                </span>
                <Button onClick={submit}>Submit booking request</Button>
              </div>
              {err && <Alert kind="error">{err}</Alert>}
            </div>)}
        </Card>)}
    </div>);
}
function TimeGrid({ times, value, onChange, recurring, empty }) {
    if (!times.length)
        return <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">{empty}</div>;
    return (<div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {times.map((t) => {
            const disabled = !t.open;
            return (<button key={t.time} disabled={disabled} onClick={() => onChange(t.time)} className={cn("rounded-xl border p-2 text-sm font-bold transition", value === t.time ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 bg-white", disabled ? "cursor-not-allowed text-slate-300 line-through" : "hover:border-brand-400")}>
            {fmtTime(t.time)}
            <div className={cn("text-[10px] font-semibold", value === t.time ? "text-white/80" : "text-slate-400")}>
              {disabled ? "occupied" : t.any === 0 ? "awaiting tutor" : recurring ? `${t.full} full · ${t.any} place(s) available` : `${t.any} place(s) available`}
            </div>
          </button>);
        })}
    </div>);
}
