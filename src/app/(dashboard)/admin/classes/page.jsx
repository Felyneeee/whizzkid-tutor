"use client";
import { useEffect, useMemo, useState } from "react";
import { Alert, Badge, Button, Card, Field, Input, Modal, PageHeader, Select } from "@/components/ui";
import { addDays, DAY_NAMES, fmtDate, fmtTime, todayISO, weekday } from "@/lib/dates";
import { cohortSessionDates, onApprovedLeave, tutorBusy, tutorWorksPlaygroupDate } from "@/lib/logic";
import { useStore } from "@/lib/store";
import { loadStateWhenRevisionChanges } from "@/lib/state-revision";

const COHORT_WEEKDAYS = [1, 3, 5];
const mondayOnOrAfter = (date) => addDays(date, (1 - weekday(date) + 7) % 7);
const activeBookingStatuses = ["pending", "approved", "confirmed", "awaiting_admin"];
const pendingPlaygroupStatuses = ["pending", "awaiting_admin"];
const bookingStatusOf = (booking) => String(booking.status || booking.bookingStatus || "").toLowerCase();
const dateOptionLabel = (date) => new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(new Date(`${date}T12:00:00`)).replace(", ", " | ");
const bookedDateLabel = (date) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${date}T12:00:00`));
const playgroupBookingSignature = (bookings = []) => JSON.stringify(bookings
  .filter((booking) => booking.program === "playgroup")
  .map(({ id, cohortId, tuteeId, status, createdAt }) => [id, cohortId || "", tuteeId, status, createdAt || ""])
  .sort((a, b) => String(a[0]).localeCompare(String(b[0]))));
const nextAvailableStartWeek = (cohorts, today) => {
    const occupiedDates = new Set(cohorts.flatMap((cohort) => cohortSessionDates(cohort)));
    const latestOccupiedDate = [...occupiedDates].sort().pop();
    let candidate = mondayOnOrAfter(addDays(today, 1));
    while (latestOccupiedDate && candidate <= latestOccupiedDate) {
        const proposedDates = cohortSessionDates({ startDate: candidate, weekdays: COHORT_WEEKDAYS, sessionsCount: 12 });
        if (!proposedDates.some((date) => occupiedDates.has(date))) break;
        candidate = addDays(candidate, 7);
    }
    return candidate;
};

export default function Classes({ embedded = false } = {}) {
    const s = useStore();
    const today = todayISO();
    const [cohortOpen, setCohortOpen] = useState(false);
    const [cohortError, setCohortError] = useState("");
    const [pageError, setPageError] = useState("");
    const [bookingActionErrors, setBookingActionErrors] = useState({});
    const [bookingApprovalBusy, setBookingApprovalBusy] = useState({});
    const [replacementErrors, setReplacementErrors] = useState({});
    const [replacementBusy, setReplacementBusy] = useState({});
    const [replacementDrafts, setReplacementDrafts] = useState({});
    const [editingAssignments, setEditingAssignments] = useState({});
    const [weekdayDrafts, setWeekdayDrafts] = useState({});
    const [scheduleSaveErrors, setScheduleSaveErrors] = useState({});
    const [scheduleSaveBusy, setScheduleSaveBusy] = useState({});
    const [editingCohortId, setEditingCohortId] = useState(null);
    const [c, setC] = useState({ label: "", startDate: "", weekdays: COHORT_WEEKDAYS, time: "10:00", modality: "face-to-face", capacity: 6, sessionsCount: 12, assignmentMode: "manual", weekdayTutorIds: {} });
    useEffect(() => {
      const currentSignature = playgroupBookingSignature(s.db.bookings);
      let knownRevision = s.revision;
      const refreshIfChanged = async () => {
        if (document.visibilityState !== "visible") return;
        try {
          const refreshed = await loadStateWhenRevisionChanges(knownRevision);
          knownRevision = refreshed.revision;
          if (refreshed.db && playgroupBookingSignature(refreshed.db.bookings) !== currentSignature) window.location.reload();
        } catch { /* Keep the current page if the refresh check cannot reach the server. */ }
      };
      const timer = window.setInterval(refreshIfChanged, 8000);
      const handleVisibility = () => { if (document.visibilityState === "visible") void refreshIfChanged(); };
      document.addEventListener("visibilitychange", handleVisibility);
      return () => {
        window.clearInterval(timer);
        document.removeEventListener("visibilitychange", handleVisibility);
      };
    }, [s.db.bookings, s.revision]);
    const nm = (id) => s.db.tutees.find((t) => t.userId === id)?.fullName || id;
    const tutors = useMemo(() => s.db.tutors.filter((t) => t.status === "active"), [s.db.tutors]);
    const assignedPlaygroupTutorIds = new Set((s.db.cohorts || []).flatMap((cohort) => [
      ...Object.values(cohort.weekdayTutorIds || {}),
      ...Object.values(cohort.dateTutorOverrides || {}),
    ]));
    const assignedPlaygroupTutorCount = tutors.filter((tutor) => assignedPlaygroupTutorIds.has(tutor.userId)).length;
    const unassignedPlaygroupTutorCount = tutors.length - assignedPlaygroupTutorCount;
    const upcomingPlaygroupDates = [...new Set((s.db.cohorts || []).flatMap((cohort) => cohortSessionDates(cohort).filter((date) => date >= today)))];
    const availablePlaygroupTutorCount = tutors.filter((tutor) => upcomingPlaygroupDates.some((date) => tutorWorksPlaygroupDate(s.db, tutor.userId, date) && !onApprovedLeave(s.db, tutor.userId, date) && !tutorBusy(s.db, tutor.userId, date, "10:00"))).length;
    const tutorHandled = useMemo(() => {
      const rows = new Map(tutors.map((tutor) => [tutor.userId, { tutor, counts: { 1: 0, 3: 0, 5: 0 } }]));
      (s.db.cohorts || []).forEach((cohort) => {
        const dates = cohortSessionDates(cohort);
        const cohortBookings = (s.db.bookings || []).filter((booking) => booking.program === "playgroup" && booking.cohortId === cohort.id);
        dates.forEach((date) => {
          const day = weekday(date);
          const tutorId = cohort.dateTutorOverrides?.[date]
            || cohort.weekdayTutorIds?.[day]
            || cohortBookings.find((booking) => booking.tutorAssignments?.[date])?.tutorAssignments?.[date]
            || cohortBookings.find((booking) => booking.tutorId)?.tutorId;
          if (rows.has(tutorId) && [1, 3, 5].includes(day)) rows.get(tutorId).counts[day] += 1;
        });
      });
      return [...rows.values()].map(({ tutor, counts }) => ({ tutor, counts, total: counts[1] + counts[3] + counts[5] }));
    }, [s.db.cohorts, tutors, s.db.bookings]);
    const earliestStartWeek = nextAvailableStartWeek(s.db.cohorts, today);
    const draftDates = c.startDate && weekday(c.startDate) === 1
      ? cohortSessionDates({ ...c, weekdays: COHORT_WEEKDAYS, sessionsCount: 12 }).slice().sort()
      : [];
    const tutorOptionsForDay = (cohort, day, dates) => {
      const sessionDates = dates.filter((date) => date >= today && weekday(date) === day);
      return tutors.filter((tutor) => {
        if (!sessionDates.length) return false;
        return sessionDates.every((date) => (
          !onApprovedLeave(s.db, tutor.userId, date)
          && tutorWorksPlaygroupDate(s.db, tutor.userId, date)
          && !tutorBusy(s.db, tutor.userId, date, cohort.time || "10:00")
        ));
      });
    };
    const openCohortForm = () => {
      setEditingCohortId(null);
      setC({ label: "", startDate: earliestStartWeek, weekdays: COHORT_WEEKDAYS, time: "10:00", modality: "face-to-face", capacity: 6, sessionsCount: 12, assignmentMode: "manual", weekdayTutorIds: {} });
      setCohortError("");
      setCohortOpen(true);
    };
    const openEditForm = (cohort) => {
      setEditingCohortId(cohort.id);
      setC({ label: cohort.label, startDate: cohort.startDate, weekdays: COHORT_WEEKDAYS, time: "10:00", modality: "face-to-face", capacity: 6, sessionsCount: 12, assignmentMode: cohort.assignmentMode || "manual", weekdayTutorIds: cohort.weekdayTutorIds || {} });
      setCohortError("");
      setCohortOpen(true);
    };
    const saveCohort = async (event) => {
      event.preventDefault();
      if (!c.label.trim()) {
        setCohortError("Enter a cohort name.");
        return;
      }
      if (!c.startDate || weekday(c.startDate) !== 1) {
        setCohortError("Choose a Monday to set the cohort’s start week.");
        return;
      }
      if (!editingCohortId && c.startDate < earliestStartWeek) {
        setCohortError(`Choose a start week on or after ${fmtDate(earliestStartWeek)}. Cohorts cannot overlap.`);
        return;
      }
      if (editingCohortId && c.startDate !== s.db.cohorts.find((cohort) => cohort.id === editingCohortId)?.startDate && c.startDate < today) {
        setCohortError("A cycle can only be moved to a future date.");
        return;
      }
      try {
        const priorCohort = editingCohortId ? s.db.cohorts.find((cohort) => cohort.id === editingCohortId) : null;
        const result = editingCohortId
          ? await s.updateCohort(editingCohortId, { label: c.label.trim(), startDate: c.startDate })
          : await s.addCohort({ ...c, label: c.label.trim(), weekdays: COHORT_WEEKDAYS, time: "10:00", modality: "face-to-face", capacity: 6, sessionsCount: 12, assignmentMode: "manual", weekdayTutorIds: {} });
        if (result === false || result?.ok === false) {
          setCohortError(result.error || "The cohort could not be created.");
          return;
        }
        if (priorCohort && (priorCohort.label !== c.label.trim() || priorCohort.startDate !== c.startDate)) {
          const cohortBookings = s.db.bookings.filter((booking) => booking.program === "playgroup" && booking.cohortId === editingCohortId && activeBookingStatuses.includes(booking.status));
          const recipientIds = new Set([...cohortBookings.flatMap((booking) => [booking.tuteeId, ...Object.values(booking.tutorAssignments || {})]), ...Object.values(priorCohort.weekdayTutorIds || {}), ...Object.values(priorCohort.dateTutorOverrides || {})]);
          if (priorCohort.startDate !== c.startDate) cohortBookings.forEach((booking) => recipientIds.delete(booking.tuteeId));
          await Promise.all([...recipientIds].filter(Boolean).map((userId) => s.notify(userId, `The Playgroup cohort ${priorCohort.label} was edited. Check your schedule for the updated cohort details.`, ["web", "email", "sms"])));
        }
        setCohortOpen(false);
      } catch (error) {
        setCohortError(error instanceof Error ? error.message : "The cohort could not be created.");
      }
    };
    const deleteCohort = async (cohort) => {
      const activeCount = s.db.bookings.filter((booking) => booking.program === "playgroup" && booking.cohortId === cohort.id && activeBookingStatuses.includes(booking.status)).length;
      const detail = activeCount ? ` This will cancel ${activeCount} active booking(s) and notify their families and assigned tutors.` : "";
      if (!confirm(`Delete ${cohort.label}?${detail}`)) return;
      setPageError("");
      const result = await s.deleteCohort(cohort.id);
      if (!result.ok) setPageError(result.error || "The cohort could not be deleted.");
    };
    const replaceTutorOnDate = async (cohort, date, tutorId, reload = true) => {
      if (!tutorId) return;
      const key = `${cohort.id}:${date}`;
      setReplacementErrors((current) => ({ ...current, [key]: "" }));
      setReplacementBusy((current) => ({ ...current, [key]: true }));
      try {
        const response = await fetch("/api/state/playgroup-tutor-replacement", {
          method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin",
          body: JSON.stringify({ cohortId: cohort.id, date, tutorId }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || "Tutor replacement could not be saved.");
        if (reload) window.location.reload();
        return true;
      } catch (error) {
        setReplacementErrors((current) => ({ ...current, [key]: error.message || "Tutor replacement could not be saved." }));
        throw error;
      } finally {
        setReplacementBusy((current) => ({ ...current, [key]: false }));
      }
    };
    const saveSchedule = async (cohort) => {
      setScheduleSaveBusy((current) => ({ ...current, [cohort.id]: true }));
      setScheduleSaveErrors((current) => ({ ...current, [cohort.id]: "" }));
      try {
        const nextWeekdays = weekdayDrafts[cohort.id] || cohort.weekdayTutorIds || {};
        for (const day of COHORT_WEEKDAYS) {
          const tutorId = nextWeekdays[day] || "";
          if (tutorId && tutorId !== (cohort.weekdayTutorIds?.[day] || "")) {
            const result = await s.assignPlaygroupWeekday(cohort.id, day, tutorId);
            if (result === false || result?.ok === false) throw new Error(result.error || "Tutor assignment could not be saved.");
          }
        }
        for (const replacement of replacementDrafts[cohort.id] || []) {
          if (replacement.date && replacement.tutorId && cohort.dateTutorOverrides?.[replacement.date] !== replacement.tutorId) {
            const saved = await replaceTutorOnDate(cohort, replacement.date, replacement.tutorId, false);
            if (saved === false) throw new Error("The replacement tutor could not be saved.");
          }
        }
        setEditingAssignments((current) => ({ ...current, [cohort.id]: false }));
        window.location.reload();
      } catch (error) {
        setScheduleSaveErrors((current) => ({ ...current, [cohort.id]: error.message || "The schedule could not be saved." }));
      } finally { setScheduleSaveBusy((current) => ({ ...current, [cohort.id]: false })); }
    };
    return (<>
      {!embedded && <PageHeader title="Playgroup Class" subtitle="Manage tutors, cohorts and booking requests." action={<Button onClick={openCohortForm}>Schedule Cohort</Button>}/>}
      {embedded && <h1 className="mb-7 text-3xl font-extrabold text-slate-800">Playgroup Class</h1>}

      {pageError && <div className="mb-4"><Alert kind="error">{pageError}</Alert></div>}
      <div className="space-y-6">
        <section className="space-y-4">
          <h2 className="text-2xl font-extrabold text-slate-800">Playgroup Tutor Monitoring</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex min-h-[102px] items-center gap-5 rounded-2xl bg-[#cfe2ff] px-7 py-5 text-[#2463eb] shadow-sm">
              <svg aria-hidden="true" viewBox="0 0 48 48" className="h-12 w-12 fill-current"><circle cx="24" cy="13" r="10"/><path d="M5 45c1-12 7-19 19-19s18 7 19 19H5z"/></svg>
              <div><div className="text-3xl font-extrabold">{tutors.length}</div><div className="font-extrabold">Total Tutors</div></div>
            </div>
            <div className="flex min-h-[102px] items-center gap-5 rounded-2xl bg-[#dceecd] px-7 py-5 text-[#70aa48] shadow-sm">
              <span aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-full bg-[#78b84b] text-3xl font-black text-white">✓</span>
              <div><div className="text-3xl font-extrabold">{availablePlaygroupTutorCount}</div><div className="font-extrabold">Available Tutors</div></div>
            </div>
            <div className="flex min-h-[102px] items-center gap-5 rounded-2xl bg-[#fbefca] px-7 py-5 text-[#d49a00] shadow-sm">
              <span aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-full bg-[#efa900] text-3xl font-black text-white">×</span>
              <div><div className="text-3xl font-extrabold">{unassignedPlaygroupTutorCount}</div><div className="font-extrabold">Not Assigned Yet</div></div>
            </div>
          </div>
          <h2 className="pt-5 text-2xl font-extrabold text-slate-800">Playgroup Sessions Handled</h2>
          <div className="overflow-hidden rounded-2xl bg-white shadow-lg">
            <div className="overflow-x-auto"><table className="w-full min-w-[620px] border-collapse text-center text-sm">
              <thead className="bg-slate-50 text-slate-500"><tr>{["Tutor", "Monday", "Wednesday", "Friday", "Total"].map((label) => <th key={label} className="px-5 py-4 font-bold">{label}</th>)}</tr></thead>
              <tbody>{tutorHandled.map(({ tutor, counts, total }) => <tr key={tutor.userId} className="border-t border-[#d1d1d1] text-slate-700"><td className="px-5 py-4">{tutor.fullName}</td><td className="px-5 py-4">{counts[1] ? counts[1] + (counts[1] === 1 ? " session" : " sessions") : "0"}</td><td className="px-5 py-4">{counts[3] ? counts[3] + (counts[3] === 1 ? " session" : " sessions") : "0"}</td><td className="px-5 py-4">{counts[5] ? counts[5] + (counts[5] === 1 ? " session" : " sessions") : "0"}</td><td className="px-5 py-4">{total ? total + (total === 1 ? " session" : " sessions") : "0"}</td></tr>)}</tbody>
            </table></div>
          </div>
        </section>
        <section className="space-y-4 rounded-3xl bg-white/80 p-5 shadow-lg sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-2xl font-extrabold">Playgroup Cohorts</h2><Button onClick={openCohortForm}>Schedule Cohort</Button></div>
        {s.db.cohorts.length === 0 && <Card><p className="text-sm text-slate-500">No cohorts scheduled yet. Create a cohort to open six slots for the next four-week playgroup cycle.</p></Card>}
        {s.db.cohorts.map((cohort) => {
          const dates = cohortSessionDates(cohort).slice().sort();
          const cohortDateSet = new Set(dates);
          const belongsToCohort = (booking) => booking.cohortId === cohort.id
            || (cohort.enrolled || []).includes(booking.tuteeId)
            || (!booking.cohortId && Array.isArray(booking.dates) && booking.dates.length > 0 && booking.dates.every((date) => cohortDateSet.has(date)));
          const enrolledBookings = s.db.bookings.filter((booking) => String(booking.program || "").toLowerCase() === "playgroup" && belongsToCohort(booking) && ["approved", "to_pay", "awaiting_payment_approval", "confirmed", "completed"].includes(bookingStatusOf(booking)));
          const startDate = dates[0];
          const endDate = dates[dates.length - 1];
          const canChangeTutors = dates.some((date) => date >= today);
          return <Card key={cohort.id} className="space-y-4 border-0 bg-neutral-100 p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h2 className="text-lg font-extrabold">{cohort.label}</h2><p className="text-sm text-slate-500">{fmtDate(startDate)} until {fmtDate(endDate)} · Mon | Wed | Fri · {dates.length} sessions</p></div>
              <div className="flex gap-2"><Button size="sm" variant={editingAssignments[cohort.id] ? "success" : "secondary"} onClick={() => { if (editingAssignments[cohort.id]) void saveSchedule(cohort); else { setWeekdayDrafts((current) => ({ ...current, [cohort.id]: { ...(cohort.weekdayTutorIds || {}) } })); setReplacementDrafts((current) => ({ ...current, [cohort.id]: [...Object.entries(cohort.dateTutorOverrides || {}).map(([date,tutorId]) => ({ date, tutorId })), { date: "", tutorId: "" }] })); setEditingAssignments((current) => ({ ...current, [cohort.id]: true })); } }}>{scheduleSaveBusy[cohort.id] ? "Saving…" : editingAssignments[cohort.id] ? "Save" : "Edit"}</Button><Button size="sm" variant="danger" onClick={() => deleteCohort(cohort)}>Delete</Button></div>
            </div>

            <section className="space-y-3 p-1 sm:p-2">
              <div>
                <h3 className="text-lg font-extrabold">Assign Tutor</h3>
                <p className="text-xs text-slate-500">Each tutor must be scheduled to work and available on every date for that weekday.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {COHORT_WEEKDAYS.map((day) => {
                  const options = tutorOptionsForDay(cohort, day, dates);
                  const assignedId = cohort.weekdayTutorIds?.[day] || "";
                  const assignedIsAvailable = options.some((tutor) => tutor.userId === assignedId);
                  return <Field key={day} label={DAY_NAMES[day].slice(0, 3).toUpperCase()}>
                    <Select disabled={!canChangeTutors || !editingAssignments[cohort.id]} value={(weekdayDrafts[cohort.id] || cohort.weekdayTutorIds || {})[day] || (assignedIsAvailable ? assignedId : "")} onChange={(event) => setWeekdayDrafts((current) => ({ ...current, [cohort.id]: { ...(current[cohort.id] || cohort.weekdayTutorIds || {}), [day]: event.target.value } }))}>
                      <option value="">{options.length ? "Select tutor" : "No available tutor"}</option>
                      {options.map((tutor) => <option key={tutor.userId} value={tutor.userId}>{tutor.fullName}</option>)}
                    </Select>
                    {!canChangeTutors && <p className="mt-1 text-xs text-slate-500">Tutor assignments lock when the cohort starts.</p>}
                    {canChangeTutors && assignedId && !assignedIsAvailable && <p className="mt-1 text-xs text-red-600">The current assignment is no longer available. Choose a working tutor.</p>}
                  </Field>;
                })}
              </div>
              {editingAssignments[cohort.id] && <div className="space-y-2 pt-1">
                <h4 className="text-sm font-bold text-slate-600">Replace Tutor on Specific Dates</h4>
                {(replacementDrafts[cohort.id] || [...Object.entries(cohort.dateTutorOverrides || {}).map(([date, tutorId]) => ({ date, tutorId })), { date: "", tutorId: "" }]).map((replacement, index) => {
                  const key = `${cohort.id}:${replacement.date}`;
                  const rows = replacementDrafts[cohort.id] || [...Object.entries(cohort.dateTutorOverrides || {}).map(([date, tutorId]) => ({ date, tutorId })), { date: "", tutorId: "" }];
                  const dateOptions = dates.filter((date) => date >= today && (date === replacement.date || !rows.some((row) => row.date === date)));
                  const baseTutorId = replacement.date ? (cohort.weekdayTutorIds?.[weekday(replacement.date)] || "") : "";
                  const options = tutors.filter((tutor) => tutor.userId !== baseTutorId && (!replacement.date || (
                    tutorWorksPlaygroupDate(s.db, tutor.userId, replacement.date)
                    && !onApprovedLeave(s.db, tutor.userId, replacement.date)
                    && !tutorBusy(s.db, tutor.userId, replacement.date, cohort.time || "10:00")
                  )));
                  return <div key={index} className="grid gap-2 sm:max-w-3xl sm:grid-cols-[1fr_1fr_auto]">
                    <Select value={replacement.tutorId || ""} disabled={!replacement.date || replacementBusy[key]} onChange={(event) => setReplacementDrafts((current) => ({ ...current, [cohort.id]: rows.map((row, rowIndex) => rowIndex === index ? { ...row, tutorId: event.target.value } : row) }))}><option value="">Select Tutor</option>{options.map((tutor) => <option value={tutor.userId} key={tutor.userId}>{tutor.fullName}</option>)}</Select>
                    <Select value={replacement.date || ""} onChange={(event) => {
                      const nextRows = [...rows];
                      nextRows[index] = { date: event.target.value, tutorId: "" };
                      setReplacementDrafts((current) => ({ ...current, [cohort.id]: nextRows }));
                    }}><option value="">Select Date</option>{dateOptions.map((date) => <option key={date} value={date}>{dateOptionLabel(date)}</option>)}</Select>
                    {index === 0 ? <button type="button" className="px-3 text-sm font-bold text-blue-600" onClick={() => setReplacementDrafts((current) => ({ ...current, [cohort.id]: [...(current[cohort.id] || [{ date: "", tutorId: "" }]), { date: "", tutorId: "" }] }))}>+ Add another</button> : <button type="button" className="px-3 text-sm text-red-600" onClick={() => setReplacementDrafts((current) => ({ ...current, [cohort.id]: (current[cohort.id] || []).filter((_, rowIndex) => rowIndex !== index) }))}>Remove</button>}
                    {replacementErrors[key] && <p className="text-xs text-red-600 sm:col-span-3">{replacementErrors[key]}</p>}
                  </div>;
                })}
              </div>}
              {scheduleSaveErrors[cohort.id] && <Alert kind="error">{scheduleSaveErrors[cohort.id]}</Alert>}
              {!editingAssignments[cohort.id] && <div className="overflow-x-auto rounded-2xl bg-white shadow-sm"><table className="w-full min-w-[650px] text-center text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr>{["Tutor", "Day & Time", "Date", "Status"].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody>{COHORT_WEEKDAYS.filter((day) => cohort.weekdayTutorIds?.[day]).map((day) => { const tutorId=cohort.weekdayTutorIds[day]; const start=dates.find((date)=>weekday(date)===day); const end=[...dates].reverse().find((date)=>weekday(date)===day); return <tr key={day} className="border-t border-slate-200"><td className="px-4 py-3">{tutors.find((t)=>t.userId===tutorId)?.fullName||"Tutor"}</td><td className="px-4 py-3">{DAY_NAMES[day]} at {fmtTime(cohort.time||"10:00")}–11:30 AM</td><td className="px-4 py-3">{bookedDateLabel(start)} until {bookedDateLabel(end)}</td><td className="px-4 py-3"><span className="rounded-full bg-green-100 px-4 py-1.5 text-xs font-bold text-green-700">Assigned</span></td></tr>}).concat(Object.entries(cohort.dateTutorOverrides||{}).map(([date,tutorId])=><tr key={date} className="border-t border-slate-200"><td className="px-4 py-3">{tutors.find((t)=>t.userId===tutorId)?.fullName||"Tutor"}</td><td className="px-4 py-3">{DAY_NAMES[weekday(date)]} at {fmtTime(cohort.time||"10:00")}–11:30 AM</td><td className="px-4 py-3">{bookedDateLabel(date)}</td><td className="px-4 py-3"><span className="rounded-full bg-amber-100 px-4 py-1.5 text-xs font-bold text-amber-700">Replacement</span></td></tr>))}{!Object.keys(cohort.weekdayTutorIds||{}).length&&!Object.keys(cohort.dateTutorOverrides||{}).length&&<tr><td colSpan={4} className="px-4 py-5 text-slate-400">No tutors assigned yet.</td></tr>}</tbody></table></div>}
            </section>

            <section className="space-y-2 rounded-2xl bg-neutral-100 p-4 sm:p-6" aria-label={`Enrolled students in ${cohort.label}`}>
              <h3 className="text-sm font-extrabold text-slate-800">Enrolled Students ({enrolledBookings.length}/{cohort.capacity || 6}):</h3>
              {enrolledBookings.length ? <ul className="space-y-1 text-sm font-semibold text-slate-700">
                {enrolledBookings.map((booking) => {
                  const student = s.db.tutees.find((tutee) => tutee.userId === booking.tuteeId);
                  return <li key={booking.id}>{student?.fullName || booking.tuteeId}{student?.age != null ? ` · ${student.age} y/o` : ""}</li>;
                })}
              </ul> : <p className="text-sm text-slate-500">No students enrolled yet. Approved bookings will appear here.</p>}
            </section>
          </Card>;
        })}
        </section>
      </div>
      <Modal open={cohortOpen} onClose={() => setCohortOpen(false)} title={editingCohortId ? "Edit playgroup cohort" : "Schedule a playgroup cohort"}>
        <form className="space-y-4" onSubmit={saveCohort}>
          <Field label="Cohort name"><Input required value={c.label} onChange={(event) => setC({ ...c, label: event.target.value })} placeholder="e.g. December Playgroup"/></Field>
          <Field label="Start week (Monday)"><Input type="date" required min={editingCohortId ? undefined : earliestStartWeek} value={c.startDate} onChange={(event) => { setC({ ...c, startDate: event.target.value }); setCohortError(event.target.value && weekday(event.target.value) === 1 ? "" : "Choose a Monday to set the cohort’s start week."); }}/><p className="mt-1 text-xs text-slate-500">{editingCohortId ? "Cycle dates cannot overlap another cohort." : `Next available start week: ${fmtDate(earliestStartWeek)}. Cohort dates cannot overlap.`}</p></Field>
          {draftDates.length > 0 && <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">12 sessions · Monday, Wednesday and Friday · {fmtDate(draftDates[0])}–{fmtDate(draftDates[draftDates.length - 1])} · maximum 6 students.</div>}
          {cohortError && <p className="text-sm text-red-600">{cohortError}</p>}
          <Button type="submit">{editingCohortId ? "Save changes" : "Create cohort"}</Button>
        </form>
      </Modal>
    </>);
}
