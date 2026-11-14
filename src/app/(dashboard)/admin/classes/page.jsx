"use client";
import { useState } from "react";
import { Alert, Badge, Button, Card, Field, Input, Modal, PageHeader, Select } from "@/components/ui";
import { DAY_NAMES, addDays, fmtDate, fmtTime, todayISO, weekday } from "@/lib/dates";
import { cohortSessionDates, onApprovedLeave, tutorBusy, tutorWorksPlaygroupDate } from "@/lib/logic";
import { useStore } from "@/lib/store";

const COHORT_WEEKDAYS = [1, 3, 5];
const mondayOnOrAfter = (date) => addDays(date, (1 - weekday(date) + 7) % 7);
const activeBookingStatuses = ["pending", "approved", "confirmed", "awaiting_admin"];
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

export default function Classes() {
    const s = useStore();
    const today = todayISO();
    const [cohortOpen, setCohortOpen] = useState(false);
    const [cohortError, setCohortError] = useState("");
    const [pageError, setPageError] = useState("");
    const [editingCohortId, setEditingCohortId] = useState(null);
    const [c, setC] = useState({ label: "", startDate: "", weekdays: COHORT_WEEKDAYS, time: "10:00", modality: "face-to-face", capacity: 6, sessionsCount: 12, assignmentMode: "manual", weekdayTutorIds: {} });
    const nm = (id) => s.db.tutees.find((t) => t.userId === id)?.fullName || id;
    const tutors = s.db.tutors.filter((t) => t.status === "active");
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
        const result = editingCohortId
          ? await s.updateCohort(editingCohortId, { label: c.label.trim(), startDate: c.startDate })
          : await s.addCohort({ ...c, label: c.label.trim(), weekdays: COHORT_WEEKDAYS, time: "10:00", modality: "face-to-face", capacity: 6, sessionsCount: 12, assignmentMode: "manual", weekdayTutorIds: {} });
        if (result === false || result?.ok === false) {
          setCohortError(result.error || "The cohort could not be created.");
          return;
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
    return (<>
      <PageHeader title="Playgroup cohorts" subtitle="One cohort has six slots for 12 sessions: Monday, Wednesday and Friday over four weeks." action={<Button onClick={openCohortForm}>Schedule cohort</Button>}/>
      {pageError && <div className="mb-4"><Alert kind="error">{pageError}</Alert></div>}
      <div className="space-y-4">
        {s.db.cohorts.length === 0 && <Card><p className="text-sm text-slate-500">No cohorts scheduled yet. Create a cohort to open six slots for the next four-week playgroup cycle.</p></Card>}
        {s.db.cohorts.map((cohort) => {
          const dates = cohortSessionDates(cohort).slice().sort();
          const activeBookings = s.db.bookings.filter((booking) => booking.program === "playgroup" && booking.cohortId === cohort.id && activeBookingStatuses.includes(booking.status));
          const startDate = dates[0];
          const endDate = dates[dates.length - 1];
          const canChangeTutors = dates.some((date) => date >= today);
          return <Card key={cohort.id} className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h2 className="text-lg font-extrabold">{cohort.label}</h2><p className="text-sm text-slate-500">12 sessions · Monday, Wednesday and Friday · {fmtTime(cohort.time || "10:00")} · {fmtDate(startDate)}–{fmtDate(endDate)}</p></div>
              <div className="flex gap-2"><Button size="sm" variant="secondary" onClick={() => openEditForm(cohort)}>Edit</Button><Button size="sm" variant="danger" onClick={() => deleteCohort(cohort)}>Delete</Button></div>
            </div>

            <section className="space-y-3 rounded-xl bg-slate-50 p-4">
              <div>
                <h3 className="font-extrabold">Assign a working tutor for each day</h3>
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
            </section>

            <section className="space-y-2 border-t pt-3">
              <h3 className="font-extrabold">Students</h3>
              {cohort.enrolled.length === 0 && <p className="text-sm text-slate-400">No student slots reserved yet.</p>}
              <div className="flex flex-wrap gap-2">
                {cohort.enrolled.map((id) => <span key={id} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">{nm(id)}<button aria-label={`Remove ${nm(id)}`} className="text-coral-600" onClick={() => confirm(`Remove ${nm(id)} from this cohort?`) && s.removeFromCohort(cohort.id, id)}>×</button></span>)}
              </div>
              {activeBookings.map((booking) => {
                const tutorNameForDay = (day) => {
                  const date = booking.dates?.find((sessionDate) => weekday(sessionDate) === day);
                  const tutorId = date ? booking.tutorAssignments?.[date] : cohort.weekdayTutorIds?.[day];
                  return s.db.tutors.find((tutor) => tutor.userId === tutorId)?.fullName || "—";
                };
                return <div key={booking.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-bold">{nm(booking.tuteeId)}</span>
                  <Badge status={booking.status}/>
                  <span className="text-xs text-slate-500">Mon: {tutorNameForDay(1)} · Wed: {tutorNameForDay(3)} · Fri: {tutorNameForDay(5)}</span>
                  {booking.status === "pending" && <Button size="sm" disabled={!booking.dates?.length || !booking.dates.every((date) => booking.tutorAssignments?.[date] || cohort.weekdayTutorIds?.[weekday(date)])} onClick={() => s.approvePlaygroupBooking(booking.id)}>Approve reservation</Button>}
                </div>;
              })}
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
