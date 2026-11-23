"use client";
import { useEffect, useMemo, useState } from "react";
import { Alert, Badge, Button, Card, Field, Input, Modal, PageHeader, Select } from "@/components/ui";
import { addDays, DAY_NAMES, fmtDate, fmtTime, todayISO, weekday } from "@/lib/dates";
import { cohortSessionDates, onApprovedLeave, tutorBusy, tutorWorksPlaygroupDate } from "@/lib/logic";
import { useStore } from "@/lib/store";

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
    const [editingCohortId, setEditingCohortId] = useState(null);
    const [c, setC] = useState({ label: "", startDate: "", weekdays: COHORT_WEEKDAYS, time: "10:00", modality: "face-to-face", capacity: 6, sessionsCount: 12, assignmentMode: "manual", weekdayTutorIds: {} });
    useEffect(() => {
      const currentSignature = playgroupBookingSignature(s.db.bookings);
      const refreshIfChanged = async () => {
        if (document.visibilityState !== "visible") return;
        try {
          const response = await fetch("/api/state", { credentials: "same-origin", cache: "no-store" });
          if (!response.ok) return;
          const payload = await response.json();
          if (playgroupBookingSignature(payload.db?.bookings) !== currentSignature) window.location.reload();
        } catch { /* Keep the current page if the refresh check cannot reach the server. */ }
      };
      const timer = window.setInterval(refreshIfChanged, 8000);
      const handleVisibility = () => { if (document.visibilityState === "visible") void refreshIfChanged(); };
      document.addEventListener("visibilitychange", handleVisibility);
      return () => {
        window.clearInterval(timer);
        document.removeEventListener("visibilitychange", handleVisibility);
      };
    }, [s.db.bookings]);
    const nm = (id) => s.db.tutees.find((t) => t.userId === id)?.fullName || id;
    const tutors = useMemo(() => s.db.tutors.filter((t) => t.status === "active"), [s.db.tutors]);
    const assignedPlaygroupTutorIds = new Set((s.db.cohorts || []).flatMap((cohort) => [
      ...Object.values(cohort.weekdayTutorIds || {}),
      ...Object.values(cohort.dateTutorOverrides || {}),
    ]));
    const availablePlaygroupTutorCount = tutors.filter((tutor) => assignedPlaygroupTutorIds.has(tutor.userId)).length;
    const unassignedPlaygroupTutorCount = tutors.length - availablePlaygroupTutorCount;
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
    const replaceTutorOnDate = async (cohort, date, tutorId) => {
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
        window.location.reload();
      } catch (error) {
        setReplacementErrors((current) => ({ ...current, [key]: error.message || "Tutor replacement could not be saved." }));
      } finally {
        setReplacementBusy((current) => ({ ...current, [key]: false }));
      }
    };
    return (<>
      {!embedded && <PageHeader title="Playgroup Class" subtitle="Manage tutors, cohorts and booking requests." action={<Button onClick={openCohortForm}>Schedule Cohort</Button>}/>}
      {embedded && <div className="mb-4 flex justify-end"><Button onClick={openCohortForm}>Schedule Cohort</Button></div>}
      {pageError && <div className="mb-4"><Alert kind="error">{pageError}</Alert></div>}
      <div className="space-y-6">
        <Card className="space-y-4">
          <h2 className="text-xl font-extrabold">Playgroup Tutor Monitoring</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl bg-amber-100 px-6 py-5 text-amber-600"><div className="text-4xl font-extrabold">{availablePlaygroupTutorCount}</div><div className="text-lg font-extrabold">Available Tutors</div></div>
            <div className="rounded-2xl bg-amber-100 px-6 py-5 text-amber-600"><div className="text-4xl font-extrabold">{unassignedPlaygroupTutorCount}</div><div className="text-lg font-extrabold">Not Assigned Yet</div></div>
          </div>
          <h2 className="pt-2 text-xl font-extrabold">Playgroup Tutor Monitoring</h2>
          <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[560px] border-collapse text-center"><thead className="bg-blue-600 text-white"><tr><th colSpan={5} className="border-b border-blue-300 px-4 py-3">Playgroup Sessions Handled</th></tr><tr>{["Tutor", "Monday", "Wednesday", "Friday", "Total"].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody>{tutorHandled.map(({ tutor, counts, total }, index) => <tr key={tutor.userId} className={index % 2 ? "bg-blue-100" : "bg-white"}><td className="border border-slate-200 px-4 py-3">{tutor.fullName}</td><td className="border border-slate-200 px-4 py-3">{counts[1]}</td><td className="border border-slate-200 px-4 py-3">{counts[3]}</td><td className="border border-slate-200 px-4 py-3">{counts[5]}</td><td className="border border-slate-200 px-4 py-3">{total}</td></tr>)}</tbody></table></div>
        </Card>
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
          return <Card key={cohort.id} className="space-y-4 border-2 border-slate-200 p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h2 className="text-lg font-extrabold">{cohort.label}</h2><p className="text-sm text-slate-500">12 sessions · Monday, Wednesday and Friday · {fmtTime(cohort.time || "10:00")} · {fmtDate(startDate)}–{fmtDate(endDate)}</p></div>
              <div className="flex gap-2"><Button size="sm" variant="secondary" onClick={() => openEditForm(cohort)}>Edit</Button><Button size="sm" variant="danger" onClick={() => deleteCohort(cohort)}>Delete</Button></div>
            </div>

            <section className="space-y-3 rounded-2xl bg-neutral-100 p-4 sm:p-6">
              <div>
                <h3 className="text-lg font-extrabold">Assign Tutor</h3>
                <p className="text-xs text-slate-500">Each tutor must be scheduled to work and available on every date for that weekday.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {COHORT_WEEKDAYS.map((day) => {
                  const options = tutorOptionsForDay(cohort, day, dates);
                  const assignedId = cohort.weekdayTutorIds?.[day] || "";
                  const assignedIsAvailable = options.some((tutor) => tutor.userId === assignedId);
                  return <Field key={day} label={DAY_NAMES[day]}>
                    <Select disabled={!canChangeTutors} value={assignedIsAvailable ? assignedId : ""} onChange={(event) => event.target.value && s.assignPlaygroupWeekday(cohort.id, day, event.target.value)}>
                      <option value="">{options.length ? "Select tutor" : "No available tutor"}</option>
                      {options.map((tutor) => <option key={tutor.userId} value={tutor.userId}>{tutor.fullName}</option>)}
                    </Select>
                    {!canChangeTutors && <p className="mt-1 text-xs text-slate-500">Tutor assignments lock when the cohort starts.</p>}
                    {canChangeTutors && assignedId && !assignedIsAvailable && <p className="mt-1 text-xs text-red-600">The current assignment is no longer available. Choose a working tutor.</p>}
                  </Field>;
                })}
              </div>
              <div className="space-y-2 pt-1">
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
                    <Select value={(replacement.date ? (cohort.dateTutorOverrides?.[replacement.date] || replacement.tutorId) : "") || ""} disabled={!replacement.date || replacementBusy[key]} onChange={(event) => replaceTutorOnDate(cohort, replacement.date, event.target.value)}><option value="">Select Tutor</option>{options.map((tutor) => <option value={tutor.userId} key={tutor.userId}>{tutor.fullName}</option>)}</Select>
                    <Select value={replacement.date || ""} onChange={(event) => {
                      const nextRows = [...rows];
                      nextRows[index] = { date: event.target.value, tutorId: "" };
                      setReplacementDrafts((current) => ({ ...current, [cohort.id]: nextRows }));
                    }}><option value="">Select Date</option>{dateOptions.map((date) => <option key={date} value={date}>{dateOptionLabel(date)}</option>)}</Select>
                    {index === 0 ? <button type="button" className="px-3 text-sm font-bold text-blue-600" onClick={() => setReplacementDrafts((current) => ({ ...current, [cohort.id]: [...(current[cohort.id] || [{ date: "", tutorId: "" }]), { date: "", tutorId: "" }] }))}>+ Add another</button> : <button type="button" className="px-3 text-sm text-red-600" onClick={() => setReplacementDrafts((current) => ({ ...current, [cohort.id]: (current[cohort.id] || []).filter((_, rowIndex) => rowIndex !== index) }))}>Remove</button>}
                    {replacementErrors[key] && <p className="text-xs text-red-600 sm:col-span-3">{replacementErrors[key]}</p>}
                  </div>;
                })}
              </div>
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
