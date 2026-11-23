"use client";
import { useCallback, useMemo, useState } from "react";
import { SlidersHorizontal, ChevronDown, ChevronUp } from "lucide-react";
import { Calendar } from "@/components/Calendar";
import { Alert, Badge, Button, Card, Empty, PageHeader, Select } from "@/components/ui";
import { addDays, fmtDate, fmtTime, todayISO } from "@/lib/dates";
import { HOURS } from "@/lib/constants";
import { approvedSlot, onApprovedLeave, tutorBusy } from "@/lib/logic";
import { useStore } from "@/lib/store";

const FILTERS = ["program", "subject", "sessionType", "modality", "bookingState"];
const EMPTY_FILTERS = Object.fromEntries(FILTERS.map((key) => [key, "All"]));
const label = (value = "") => String(value).replace(/_/g, " ").replace(/\b\w/g, (x) => x.toUpperCase());
const timeRange = (time) => {
  const [hour, minute] = time.split(":").map(Number);
  const end = `${String(Math.floor((hour * 60 + minute + 45) / 60) % 24).padStart(2, "0")}:${String((minute + 45) % 60).padStart(2, "0")}`;
  return `${fmtTime(time)}-${fmtTime(end)}`;
};

export default function Scheduling() {
  const s = useStore();
  const db = s.db;
  const today = todayISO();
  const [selectedDate, setSelectedDate] = useState(today);
  const [calendarMonth, setCalendarMonth] = useState(today.slice(0, 7));
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [showUnbooked, setShowUnbooked] = useState(false);
  const [slotMonth, setSlotMonth] = useState("this-month");
  const [expanded, setExpanded] = useState({});
  const [pick, setPick] = useState({});
  const [err, setErr] = useState("");
  const [reschedule, setReschedule] = useState(null);
  const [rescheduleError, setRescheduleError] = useState("");
  const selectDate = (date) => { setSelectedDate(date); setCalendarMonth(date.slice(0, 7)); };

  const tn = useCallback((id) => db.tutors.find((t) => t.userId === id)?.fullName || "—", [db.tutors]);
  const un = useCallback((id) => db.tutees.find((t) => t.userId === id)?.fullName || "—", [db.tutees]);
  const bookings = useMemo(() => db.bookings || [], [db.bookings]);
  const activeSessions = useMemo(() => (db.sessions || []).filter((x) => x.status !== "cancelled"), [db.sessions]);
  const activeAssessments = useMemo(() => (db.assessments || []).filter((x) => x.date && ["booked", "completed"].includes(x.status)), [db.assessments]);
  const activePlaygroups = useMemo(() => bookings.filter((b) => b.program === "playgroup" && ["pending", "approved", "confirmed", "awaiting_admin", "to_pay", "awaiting_payment_approval"].includes(b.status)), [bookings]);
  const flagged = activeSessions.filter((x) => x.status === "needs_reassignment");

  const entries = useMemo(() => {
    const result = [];
    const sessions = (db.sessions || []).filter((x) => x.status !== "cancelled");
    sessions.forEach((session) => {
      const booking = bookings.find((b) => b.id === session.bookingId) || {};
      const subjects = booking.sessionSlots?.filter((slot) => slot.date === session.date && slot.time === session.time).map((slot) => slot.subject).filter(Boolean) || [];
      const isGroup = booking.sessionType === "group";
      const groupOccupancy = isGroup ? sessions.filter((item) => item.date === session.date && item.time === session.time && item.tutorId === session.tutorId && bookings.find((b) => b.id === item.bookingId)?.sessionType === "group").length : 1;
      result.push({ key: `session-${session.id}`, date: session.date, time: session.time, tutor: tn(session.tutorId), tutorId: session.tutorId, students: [un(session.tuteeId)], grade: booking.gradeLevel || "—", program: booking.program || "academic", subject: subjects[0] || booking.subject || "—", programType: label(booking.program || "academic"), sessionType: booking.sessionType || "one-on-one", modality: session.modality || booking.modality || "online", state: isGroup && groupOccupancy < 2 ? "Partially booked" : "Booked", capacity: isGroup ? `${groupOccupancy}/2` : "1/1", status: session.status, raw: session });
    });
    activeAssessments.forEach((assessment) => result.push({ key: `assessment-${assessment.id}`, date: assessment.date, time: assessment.time, tutor: "Admin scheduled", tutorId: null, students: [un(assessment.tuteeId)], grade: "—", program: "reading", subject: "Reading", programType: "Reading Programs", sessionType: "one-on-one", modality: assessment.modality || "online", state: "Booked", capacity: "1/1", status: assessment.status }));
    const cohorts = new Map();
    activePlaygroups.forEach((booking) => (booking.dates || []).forEach((date) => {
      const cohort = (db.cohorts || []).find((item) => item.id === booking.cohortId);
      const time = cohort?.time || booking.time || "10:00";
      const tutorId = booking.tutorAssignments?.[date] || booking.tutorId || "unassigned";
      const key = `${booking.cohortId || "unassigned"}-${date}-${time}-${tutorId}`;
      const group = cohorts.get(key) || { key, date, time, tutorId, bookings: [] };
      group.bookings.push(booking); cohorts.set(key, group);
    }));
    cohorts.forEach((group) => {
      const booking = group.bookings[0]; const cohort = (db.cohorts || []).find((x) => x.id === booking.cohortId);
      const uniqueBookings = [...new Map(group.bookings.map((item) => [item.tuteeId, item])).values()];
      const capacity = cohort?.capacity || 6;
      result.push({ key: `playgroup-${group.key}`, date: group.date, time: group.time, tutor: group.tutorId === "unassigned" ? "Unassigned" : tn(group.tutorId), tutorId: group.tutorId === "unassigned" ? null : group.tutorId, students: uniqueBookings.map((b) => un(b.tuteeId)), grade: "Preschool", program: "playgroup", subject: "Playgroup", programType: "Playgroup Class", sessionType: "group", modality: cohort?.modality || booking.modality || "face-to-face", state: uniqueBookings.length < capacity ? "Partially booked" : "Booked", capacity: `${uniqueBookings.length}/${capacity}`, status: booking.status });
    });

    // Approved availability is shown as an open slot when no booking uses that tutor/time.
    const selected = new Date(`${calendarMonth}-01T12:00:00`);
    const monthDays = new Date(selected.getFullYear(), selected.getMonth() + 1, 0).getDate();
    const dates = new Set([selectedDate, ...activeSessions.map((x) => x.date), ...activeAssessments.map((x) => x.date)]);
    for (let day = 1; day <= monthDays; day++) dates.add(`${selected.getFullYear()}-${String(selected.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
    (db.availability || []).filter((a) => a.status === "approved").forEach((a) => dates.add(a.date));
    for (const date of dates) {
      if (!date) continue;
      for (const tutor of db.tutors || []) {
        if (tutor.status !== "active" || onApprovedLeave(db, tutor.userId, date)) continue;
        for (const time of HOURS) {
          if (!HOURS.includes(time) || !(tutor.subjects || []).length) continue;
          const available = ["online", "face-to-face"].some((modality) => approvedSlot(db, tutor.userId, date, time, modality));
          if (!available || tutorBusy(db, tutor.userId, date, time)) continue;
          const hasEntry = result.some((item) => item.date === date && item.time === time && item.tutorId === tutor.userId);
          if (hasEntry) continue;
          const tutorSubjects = tutor.subjects || [];
          const supportedPrograms = [...(tutorSubjects.some((subject) => subject !== "Reading") ? ["academic"] : []), ...(tutorSubjects.includes("Reading") ? ["reading"] : [])];
          const programNames = supportedPrograms.map((program) => program === "academic" ? "Academic" : "Reading");
          const programTypes = supportedPrograms.map((program) => program === "academic" ? "Academic Tutorials" : "Reading Programs");
          result.push({ key: `open-${date}-${time}-${tutor.userId}`, date, time, tutor: tutor.fullName, tutorId: tutor.userId, students: [], grade: "—", program: supportedPrograms[0] || "academic", programs: supportedPrograms, programNames, programTypes, programType: programTypes[0] || "Academic Tutorials", subject: tutorSubjects.join(" · ") || "—", sessionType: "", modality: "", state: "Unbooked", capacity: "0/1", status: "available" });
        }
      }
    }
    return result;
  }, [db, calendarMonth, selectedDate, bookings, activeSessions, activeAssessments, activePlaygroups, tn, un]);

  const optionValues = (key) => {
    const values = entries.flatMap((item) => key === "bookingState" ? [item.state] : key === "program" && item.programNames ? item.programNames : key === "sessionType" ? [item.sessionType === "group" ? "Group Session" : item.sessionType ? "One-on-One" : ""] : key === "modality" ? [label(item.modality)] : [label(item[key])]).filter(Boolean);
    if (key === "program") values.push("Academic", "Reading", "Playgroup");
    if (key === "subject") values.push("Playgroup");
    if (key === "sessionType") values.push("One-on-One", "Group Session");
    if (key === "modality") values.push("Face-To-Face", "Online");
    return [...new Set(values)].sort();
  };
  const matches = (entry) => FILTERS.every((key) => {
    if (filters[key] === "All") return true;
    if (entry.state === "Unbooked" && ["sessionType", "modality"].includes(key)) return true;
    if (entry.state === "Unbooked" && key === "program") return entry.programNames.includes(filters[key]);
    const value = key === "bookingState" ? entry.state : key === "sessionType" ? entry.sessionType === "group" ? "Group Session" : entry.sessionType ? "One-on-One" : "" : key === "modality" ? label(entry.modality) : label(entry[key]);
    return value === filters[key];
  });
  const filteredEntries = entries.filter(matches);
  const dayEntries = filteredEntries.filter((entry) => entry.state !== "Unbooked" && entry.date === selectedDate).sort((a, b) => a.time.localeCompare(b.time));
  const timeGroups = [...new Map(dayEntries.map((entry) => [entry.time, { time: entry.time, entries: [] }])).values()];
  timeGroups.forEach((group) => { group.entries = dayEntries.filter((entry) => entry.time === group.time); });
  const selectedMonth = calendarMonth;
  const calendarSlots = [...new Map(filteredEntries.filter((entry) => entry.date.startsWith(selectedMonth)).map((entry) => [`${entry.date}|${entry.time}|${entry.tutorId || entry.tutor}`, entry])).values()];
  const remainingCapacity = (entry) => {
    if (entry.state === "Booked") return 0;
    const [occupied, capacity] = String(entry.capacity || "0/1").split("/").map(Number);
    return Math.max(0, capacity - occupied);
  };
  const slotsByDate = calendarSlots.reduce((result, entry) => { result[entry.date] = (result[entry.date] || 0) + remainingCapacity(entry); return result; }, {});
  const availableSlotCount = calendarSlots.reduce((total, entry) => total + remainingCapacity(entry), 0);
  const fullyBookedCount = calendarSlots.filter((entry) => entry.state === "Booked").length;
  const slotMonths = [...new Set(filteredEntries.map((entry) => entry.date.slice(0, 7)))].sort();
  const monthLabel = (month) => new Date(`${month}-01T12:00:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const visibleSlotEntries = filteredEntries.filter((entry) => slotMonth === "all" || entry.date.slice(0, 7) === (slotMonth === "this-month" ? today.slice(0, 7) : slotMonth));
  const eligible = (sessionId) => {
    const session = db.sessions.find((x) => x.id === sessionId);
    if (!session) return [];
    return db.tutors.filter((t) => t.status === "active" && t.userId !== session.tutorId && approvedSlot(db, t.userId, session.date, session.time, session.modality) && !onApprovedLeave(db, t.userId, session.date) && !tutorBusy(db, t.userId, session.date, session.time));
  };

  return <>
    <PageHeader title="Calendar" />
    {flagged.length > 0 && <Card className="mb-5 border-coral-100 bg-coral-50"><h2 className="mb-2 font-extrabold text-coral-600">Conflicts needing reassignment ({flagged.length})</h2><div className="space-y-2">{flagged.map((x) => {
      const opts = eligible(x.id);
      return <div key={x.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-white p-3 text-sm"><div className="min-w-[200px] flex-1"><b>{fmtDate(x.date)} {fmtTime(x.time)}</b> · {un(x.tuteeId)} · {tn(x.tutorId)}</div><Select className="!w-48" value={pick[x.id] || ""} onChange={(e) => setPick({ ...pick, [x.id]: e.target.value })}><option value="">{opts.length ? "Choose tutor…" : "No tutor free"}</option>{opts.map((t) => <option key={t.userId} value={t.userId}>{t.fullName}</option>)}</Select><Button size="sm" disabled={!pick[x.id]} onClick={async () => { const r = await s.reassignSession(x.id, pick[x.id]); setErr(r.ok ? "" : r.error); }}>Reassign</Button><Button size="sm" variant="danger" onClick={() => s.cancelSession(x.id)}>Cancel & reschedule</Button></div>;
    })}</div>{err && <div className="mt-2"><Alert kind="error">{err}</Alert></div>}</Card>}

    <div className="grid items-start gap-4 lg:grid-cols-[minmax(320px,0.85fr)_minmax(0,1.4fr)]">
      <Card className="p-3 sm:p-5"><Calendar selected={[selectedDate]} onSelect={selectDate} onMonthChange={setCalendarMonth} allowPast initialMonth={selectedDate} mark={(date) => new Date(`${date}T12:00:00`).getDay() === 0 ? null : ({ text: `${slotsByDate[date] || 0} Slot${slotsByDate[date] === 1 ? "" : "s"}`, tone: slotsByDate[date] ? "brand" : "coral" })} />
        <div className="mt-4 flex items-center justify-between gap-2"><Button size="sm" variant="secondary" onClick={() => selectDate(addDays(selectedDate, -1))}>Previous day</Button><Button size="sm" variant="ghost" onClick={() => selectDate(today)}>Today</Button><Button size="sm" variant="secondary" onClick={() => selectDate(addDays(selectedDate, 1))}>Next day</Button></div>
        <div className="mt-4 flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs font-extrabold text-slate-600"><span><b className="text-mint-600">{availableSlotCount}</b> Available Slots</span><span><b className="text-brand-600">{fullyBookedCount}</b> Fully Booked Slots</span></div>
      </Card>
      <Card className="min-h-[520px] p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-xl font-extrabold">{fmtDate(selectedDate)}</h2><button type="button" onClick={() => setFiltersOpen((value) => !value)} aria-label="Toggle schedule filters" className="rounded-xl p-2 text-brand-600 hover:bg-brand-50"><SlidersHorizontal className="h-5 w-5"/></button></div>
        {filtersOpen && <div className="mb-5 grid gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-3">{FILTERS.map((key) => <label key={key} className="text-xs font-bold text-slate-500">{({ program: "Program", subject: "Subject", sessionType: "Type of session", modality: "Type of modality", bookingState: "Booking status" })[key]}<Select className="mt-1" value={filters[key]} onChange={(e) => setFilters((current) => ({ ...current, [key]: e.target.value }))}><option>All</option>{optionValues(key).map((option) => <option key={option}>{option}</option>)}{key === "bookingState" && !optionValues(key).includes("Partially booked") && <option>Partially booked</option>}</Select></label>)}<div className="sm:col-span-2 lg:col-span-3"><Button size="sm" variant="secondary" onClick={() => setFilters(EMPTY_FILTERS)}>Clear filters</Button></div></div>}
        <div className="space-y-3 overflow-y-auto lg:max-h-[590px]">{dayEntries.length === 0 ? <Empty>No schedule entries match these filters.</Empty> : timeGroups.map((group) => {
          const isOpen = expanded[group.time] ?? false;
          return <div key={group.time} className={`overflow-hidden rounded-2xl border-2 bg-white ${isOpen ? "border-brand-500" : "border-slate-300"}`}><button type="button" onClick={() => setExpanded((current) => ({ ...current, [group.time]: !isOpen }))} className={`flex w-full items-center justify-between px-4 py-3 text-left font-bold ${isOpen ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-700"}`}><span>{timeRange(group.time)}</span>{isOpen ? <ChevronUp className="h-5 w-5"/> : <ChevronDown className="h-5 w-5"/>}</button>
            {isOpen && <div className="space-y-3 p-3">{group.entries.map((entry) => <div key={entry.key} className="rounded-2xl border-2 border-brand-500 bg-white p-4"><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><h3 className="font-extrabold">{entry.tutor}</h3><Badge status={entry.state === "Booked" ? "confirmed" : "available"}>{entry.state === "Unbooked" ? "Available" : entry.state === "Partially booked" ? "Partially Booked" : "Booked"}</Badge></div>{entry.state === "Unbooked" ? <p className="text-sm text-slate-600">{[...entry.programNames, ...entry.subject.split(" · ").filter((subject) => !entry.programNames.includes(subject))].filter(Boolean).join(" · ")}</p> : <><p className="text-sm text-slate-600">{entry.program === "playgroup" ? `Playgroup · ${label(entry.modality)}` : `${label(entry.program)} · ${entry.subject} · ${label(entry.sessionType)} · ${label(entry.modality)}`}</p><div className="mt-4 grid grid-cols-[1fr_auto] gap-y-1 text-sm text-slate-600"><span>Student</span><span className="text-right">{entry.students.join(" · ") || "---"}</span><span>Grade Level</span><span className="text-right">{entry.grade}</span><span>Capacity Occupied</span><span className="text-right">{entry.capacity}</span></div>{entry.status === "scheduled" && entry.raw?.date >= today && <Button size="sm" variant="secondary" className="mt-3" onClick={() => { setReschedule({ id: entry.raw.id, date: entry.raw.date, time: entry.raw.time }); setRescheduleError(""); }}>Reschedule</Button>}</>}</div>)}</div>}
          </div>;
        })}</div>
      </Card>
    </div>
    <Button className="mt-4 w-full rounded-2xl py-3" onClick={() => setShowUnbooked(true)}>View all unbooked slots</Button>
    {showUnbooked && <div className="fixed inset-0 z-40 overflow-y-auto bg-white/95 p-4 backdrop-blur-sm sm:p-8"><div className="mx-auto max-w-7xl py-6"><button type="button" className="mb-8 font-bold text-brand-600" onClick={() => setShowUnbooked(false)}>← Back to Calendar</button><div className="mb-5 flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-3xl font-extrabold">Slot Availability</h1><p className="text-sm text-slate-500">Filter unbooked and partially booked slots by month.</p></div><label className="w-full max-w-xs text-sm font-bold text-slate-600">Month<Select className="mt-1" value={slotMonth} onChange={(event) => setSlotMonth(event.target.value)}><option value="this-month">This month</option><option value="all">All months</option>{slotMonths.filter((month) => month !== today.slice(0, 7)).map((month) => <option key={month} value={month}>{monthLabel(month)}</option>)}</Select></label></div><details className="mb-8 overflow-hidden rounded-xl bg-white shadow-sm"><summary className="cursor-pointer bg-brand-600 px-5 py-4 text-xl font-extrabold text-white">Unbooked Slots</summary><div className="p-4"><p className="mb-2 text-sm font-semibold text-slate-500">Total of <span className="text-coral-500">{visibleSlotEntries.filter((entry) => entry.state === "Unbooked").length}</span> Unbooked Slots</p><div className="mb-12 overflow-x-auto rounded-xl bg-white shadow-sm"><table className="w-full min-w-[760px] text-center text-sm"><thead className="bg-brand-600 text-white"><tr>{["Date", "Time", "Program", "Subject", "Grade Levels", "Available Tutor"].map((head) => <th key={head} className="px-4 py-5">{head}</th>)}</tr></thead><tbody className="divide-y divide-slate-300">{visibleSlotEntries.filter((entry) => entry.state === "Unbooked").map((entry) => <tr key={entry.key}><td className="px-4 py-4">{fmtDate(entry.date)}</td><td>{fmtTime(entry.time)}</td><td>{entry.programNames.join(" · ")}</td><td>{entry.subject}</td><td>{entry.grade}</td><td>{entry.tutor}</td></tr>)}</tbody></table></div></div></details><details className="overflow-hidden rounded-xl bg-white shadow-sm"><summary className="cursor-pointer bg-brand-600 px-5 py-4 text-xl font-extrabold text-white">Partially Booked Slots</summary><div className="p-4"><p className="mb-2 text-sm font-semibold text-slate-500">Total of <span className="text-coral-500">{visibleSlotEntries.filter((entry) => entry.state === "Partially booked").length}</span> Partially Booked Slots</p><div className="overflow-x-auto rounded-xl bg-white shadow-sm"><table className="w-full min-w-[860px] text-center text-sm"><thead className="bg-brand-600 text-white"><tr>{["Date", "Time", "Program", "Subject", "Grade Levels", "Capacity Occupied", "Assigned Tutor"].map((head) => <th key={head} className="px-4 py-5">{head}</th>)}</tr></thead><tbody className="divide-y divide-slate-300">{visibleSlotEntries.filter((entry) => entry.state === "Partially booked").map((entry) => <tr key={entry.key}><td className="px-4 py-4">{fmtDate(entry.date)}</td><td>{fmtTime(entry.time)}</td><td>{label(entry.program)}</td><td>{entry.subject}</td><td>{entry.grade}</td><td>{entry.capacity}</td><td>{entry.tutor}</td></tr>)}</tbody></table></div></div></details></div></div>}
    {reschedule && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={() => setReschedule(null)}><div className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-6" onClick={(e) => e.stopPropagation()}><h2 className="text-lg font-extrabold">Propose session reschedule</h2><div className="grid grid-cols-2 gap-3"><label className="text-xs font-bold text-slate-500">New date<input className="mt-1 w-full rounded-xl border p-2 text-sm" type="date" min={today} value={reschedule.date} onChange={(e) => setReschedule({ ...reschedule, date: e.target.value })}/></label><label className="text-xs font-bold text-slate-500">New time<Select className="mt-1" value={reschedule.time} onChange={(e) => setReschedule({ ...reschedule, time: e.target.value })}>{HOURS.map((hour) => <option key={hour} value={hour}>{fmtTime(hour)}</option>)}</Select></label></div>{rescheduleError && <Alert kind="error">{rescheduleError}</Alert>}<div className="flex gap-2"><Button onClick={async () => { const result = await s.proposeSessionReschedule(reschedule.id, reschedule.date, reschedule.time); if (!result.ok) return setRescheduleError(result.error); setReschedule(null); }}>Send to tutee for approval</Button><Button variant="secondary" onClick={() => setReschedule(null)}>Close</Button></div></div></div>}
  </>;
}
