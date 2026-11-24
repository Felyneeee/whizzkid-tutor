"use client";
import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import { Ban, CheckCircle2, ChevronDown, ClipboardCheck, Clock3, SlidersHorizontal, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Empty, Input, Modal, PageHeader, Tabs, peso } from "@/components/ui";
import { fmtDate, fmtTime, isAssessmentOutdated, weekday } from "@/lib/dates";
import { useStore } from "@/lib/store";

const CANCELLED_BOOKING_STATUSES = new Set(["cancelled", "rejected", "expired", "terminated", "declined"]);
const APPROVED_BOOKING_STATUSES = new Set(["to_pay", "awaiting_payment_approval", "confirmed", "approved"]);
const subscribeLocationSearch = (callback) => { window.addEventListener("popstate", callback); window.addEventListener("pageshow", callback); return () => { window.removeEventListener("popstate", callback); window.removeEventListener("pageshow", callback); }; };
const getLocationSearch = () => window.location.search;
const getServerLocationSearch = () => "";
const statusTone = {
  Approved: "bg-mint-100 text-mint-700",
  Completed: "bg-blue-100 text-blue-700",
  Cancelled: "bg-slate-200 text-slate-600",
  Scheduled: "bg-mint-100 text-mint-700",
  Outdated: "bg-red-100 text-red-600",
};

function dateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("en-PH", { dateStyle: "long", timeStyle: "short" });
}

function scheduleRows(booking, cohorts = []) {
  const sessions = booking.sessions || [];
  const slots = booking.sessionSlots || (booking.dates || []).map((date) => ({ date, time: booking.sessionTimes?.[date] ?? booking.time }));
  const cohort = cohorts.find((entry) => entry.id === booking.cohortId);
  const assignedTutorFor = (date) => booking.tutorAssignments?.[date]
    || cohort?.dateTutorOverrides?.[date]
    || cohort?.weekdayTutorIds?.[weekday(date)]
    || booking.tutorId;
  if (!slots.length) return sessions.map((session) => ({ ...session, tutorId: session.tutorId || assignedTutorFor(session.date) }));
  return slots.map((slot, index) => {
    const session = sessions.find((entry) => entry.date === slot.date && entry.time === slot.time);
    return {
      ...session,
      id: session?.id || `${booking.id}-${slot.date}-${slot.time}-${index}`,
      date: slot.date,
      time: slot.time,
      subject: slot.subject || booking.sessionSubjects?.[slot.date] || booking.subject,
      tutorId: session?.tutorId || assignedTutorFor(slot.date),
      status: session?.status || "scheduled",
    };
  });
}

export default function BookingRecords() {
  const s = useStore();
  const router = useRouter();
  const locationSearch = useSyncExternalStore(subscribeLocationSearch, getLocationSearch, getServerLocationSearch);
  const [tab, setTab] = useState("bookings");
  const [statusFilter, setStatusFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [sortOrder, setSortOrder] = useState("name-asc");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [selectedAssessment, setSelectedAssessment] = useState(null);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [tuteeFilterOverride, setTuteeFilterOverride] = useState(undefined);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const tuteeFilter = tuteeFilterOverride ?? new URLSearchParams(locationSearch).get("tutee") ?? "";

  const tuteeName = useCallback((id) => s.db.tutees.find((tutee) => tutee.userId === id)?.fullName || s.db.users.find((user) => user.id === id)?.username || "Tutee", [s.db.tutees, s.db.users]);
  const bookingRecords = useMemo(() => s.db.bookings.map((booking) => {
    const sessions = s.db.sessions.filter((session) => session.bookingId === booking.id);
    const activeSessions = sessions.filter((session) => session.status !== "cancelled");
    const isCancelled = CANCELLED_BOOKING_STATUSES.has(booking.status) || (sessions.length > 0 && activeSessions.length === 0);
    const isCompleted = booking.status === "completed";
    const isApproved = APPROVED_BOOKING_STATUSES.has(booking.status) || activeSessions.some((session) => session.tutorId);
    if (!isCancelled && !isCompleted && !isApproved && !sessions.some((session) => ["cancelled", "completed"].includes(session.status))) return null;
    const recordStatus = isCancelled ? "Cancelled" : isCompleted ? "Completed" : "Approved";
    return { ...booking, sessions, activeSessions, recordStatus };
  }).filter(Boolean).filter((booking) => {
    if (tuteeFilter && booking.tuteeId !== tuteeFilter) return false;
    const matchesStatus = statusFilter === "All" || booking.recordStatus === statusFilter;
    const haystack = `${tuteeName(booking.tuteeId)} ${booking.id} ${booking.subject || ""} ${booking.program || ""}`.toLowerCase();
    return matchesStatus && haystack.includes(query.trim().toLowerCase());
  }).sort((a, b) => {
    const byName = tuteeName(a.tuteeId).localeCompare(tuteeName(b.tuteeId), undefined, { sensitivity: "base" });
    return (sortOrder === "name-asc" ? byName : -byName) || String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
  }), [s.db.bookings, s.db.sessions, query, sortOrder, statusFilter, tuteeName, tuteeFilter]);

  const assessmentRecords = useMemo(() => s.db.assessments.filter((assessment) => assessment.status === "completed")
    .map((assessment) => ({ ...assessment, recordStatus: isAssessmentOutdated(assessment) ? "Outdated" : "Completed" }))
    .filter((assessment) => (!tuteeFilter || assessment.tuteeId === tuteeFilter)
      && (statusFilter === "All" || assessment.recordStatus === statusFilter)
      && `${tuteeName(assessment.tuteeId)} ${assessment.id}`.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => {
      const byName = tuteeName(a.tuteeId).localeCompare(tuteeName(b.tuteeId), undefined, { sensitivity: "base" });
      return (sortOrder === "name-asc" ? byName : -byName) || String(b.completedAt || b.date || "").localeCompare(String(a.completedAt || a.date || ""));
    }), [s.db.assessments, query, sortOrder, statusFilter, tuteeName, tuteeFilter]);

  const bookingsAll = useMemo(() => s.db.bookings.filter((booking) => !tuteeFilter || booking.tuteeId === tuteeFilter).map((booking) => {
    const sessions = s.db.sessions.filter((session) => session.bookingId === booking.id);
    const activeSessions = sessions.filter((session) => session.status !== "cancelled");
    const cancelled = CANCELLED_BOOKING_STATUSES.has(booking.status) || (sessions.length > 0 && activeSessions.length === 0);
    const completed = booking.status === "completed";
    const approved = APPROVED_BOOKING_STATUSES.has(booking.status) || activeSessions.some((session) => session.tutorId);
    return { booking, sessions, activeSessions, cancelled, completed, approved };
  }), [s.db.bookings, s.db.sessions, tuteeFilter]);
  const approvedSessionCount = bookingsAll.reduce((sum, record) => sum + (record.approved && !record.completed && !record.cancelled ? record.activeSessions.filter((session) => session.tutorId).length : 0), 0);
  const cancelledSessionCount = bookingsAll.reduce((sum, record) => sum + record.sessions.filter((session) => session.status === "cancelled").length + (record.cancelled && !record.sessions.length ? 1 : 0), 0);
  const completedBookingCount = bookingsAll.filter((record) => record.completed).length;
  const completedAssessmentCount = s.db.assessments.filter((assessment) => assessment.status === "completed" && !isAssessmentOutdated(assessment)).length;
  const outdatedAssessmentCount = s.db.assessments.filter((assessment) => assessment.status === "completed" && isAssessmentOutdated(assessment)).length;
  const profile = selectedProfile ? s.db.tutees.find((tutee) => tutee.userId === selectedProfile) : null;
  const profileAssessments = profile ? s.db.assessments.filter((assessment) => assessment.tuteeId === profile.userId).sort((a, b) => String(b.completedAt || b.date || b.createdAt || "").localeCompare(String(a.completedAt || a.date || a.createdAt || ""))) : [];
  const profileAssessment = profileAssessments.find((assessment) => assessment.status === "completed") || profileAssessments[0];
  const latestCompletedSession = profile ? s.db.sessions.filter((session) => session.tuteeId === profile.userId && session.status === "completed").sort((a, b) => `${b.date || ""}${b.time || ""}`.localeCompare(`${a.date || ""}${a.time || ""}`))[0] : null;
  const approvedAt = selectedBooking?.paymentApprovedAt || selectedBooking?.approvedAt || selectedBooking?.confirmedAt;
  const closeProfile = () => setSelectedProfile(null);
  const toggleTuteeFilter = () => {
    setTuteeFilterOverride("");
    router.replace("/admin/booking-records");
  };
  const setStatus = (value) => setStatusFilter(value);

  return <>
    <PageHeader title={tuteeFilter ? `Booking Records · ${tuteeName(tuteeFilter)}` : "Booking Records"} action={tuteeFilter ? <button type="button" aria-label={`Deselect ${tuteeName(tuteeFilter)} filter`} aria-pressed="true" onClick={toggleTuteeFilter} className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-bold text-brand-700 hover:bg-brand-100">{tuteeName(tuteeFilter)}<X className="h-4 w-4" aria-hidden="true"/></button> : null} />
    <Tabs tabs={[{ id: "bookings", label: "Bookings" }, { id: "assessments", label: "Initial Assessments" }]} value={tab} onChange={(value) => { setTab(value); setStatusFilter("All"); }} />

    {tab === "bookings" ? <>
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {[{ label: "Approved Sessions", value: approvedSessionCount, tone: "bg-mint-100 text-mint-700", icon: CheckCircle2, filter: "Approved" }, { label: "Cancelled Sessions", value: cancelledSessionCount, tone: "bg-slate-200 text-slate-600", icon: Ban, filter: "Cancelled" }, { label: "Completed Bookings", value: completedBookingCount, tone: "bg-blue-100 text-blue-700", icon: ClipboardCheck, filter: "Completed" }].map(({ label, value, tone, icon: Icon, filter }) => <button key={label} onClick={() => setStatus(statusFilter === filter ? "All" : filter)} className={`rounded-3xl p-5 text-left shadow-sm ${tone}`}><Icon className="mb-2 h-9 w-9"/><span className="block text-sm font-bold">{label}</span><span className="text-3xl font-extrabold">{value}</span></button>)}
      </div>
      <section className="rounded-3xl bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-4 flex items-center gap-3"><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search Tutee Name or Booking ID..." className="rounded-2xl border-2 border-slate-300 px-5 py-3"/><div className="relative shrink-0"><button onClick={() => setFiltersOpen((open) => !open)} aria-label="Filter booking records" aria-expanded={filtersOpen} className="rounded-xl p-2.5 text-brand-600 hover:bg-brand-50"><SlidersHorizontal className="h-5 w-5"/></button>{filtersOpen && <div className="absolute right-0 z-20 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-3 shadow-xl"><p className="px-2 pb-1 text-xs font-bold uppercase text-slate-500">Sort by name</p>{[["name-asc", "Ascending (A–Z)"], ["name-desc", "Descending (Z–A)"]].map(([value, label]) => <button key={value} onClick={() => setSortOrder(value)} className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${sortOrder === value ? "bg-brand-50 font-bold text-brand-700" : "hover:bg-slate-50"}`}>{label}</button>)}<button onClick={() => setFiltersOpen(false)} className="mt-2 w-full rounded-lg bg-brand-600 px-3 py-2 text-sm font-bold text-white">Done</button></div>}</div></div>
        <div className="mb-5 flex flex-wrap gap-2 rounded-full border-2 border-brand-500 p-1">{["All", "Approved", "Completed", "Cancelled"].map((value) => <button key={value} onClick={() => setStatus(value)} className={`min-w-24 flex-1 rounded-full px-3 py-2 text-sm font-bold ${statusFilter === value ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}>{value}</button>)}</div>
        {!bookingRecords.length ? <Empty>No booking records match this filter.</Empty> : <div className="overflow-x-auto rounded-2xl"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-slate-400 text-white"><tr>{["Name", "Program", "Completed Sessions", "Date Booked", "Status", "", ""].map((heading, index) => <th key={`${heading}-${index}`} className="px-4 py-3 font-bold">{heading}</th>)}</tr></thead><tbody>{bookingRecords.map((booking) => {
          const totalSessions = booking.sessionSlots?.length ?? booking.dates?.length ?? booking.sessions.length;
          const completedSessions = booking.sessions.filter((session) => session.status === "completed").length;
          return <tr key={booking.id} className="border-b border-slate-300 bg-slate-50 last:border-0"><td className="px-4 py-3 font-semibold">{tuteeName(booking.tuteeId)}<span className="block text-xs text-slate-500">{booking.id}</span></td><td className="px-4 py-3 capitalize">{booking.program || "—"}</td><td className="px-4 py-3 text-center">{completedSessions}/{totalSessions}</td><td className="whitespace-nowrap px-4 py-3">{dateTime(booking.createdAt || booking.at)}</td><td className="px-4 py-3"><span className={`inline-flex min-w-24 justify-center rounded-full px-3 py-1.5 text-xs font-bold ${statusTone[booking.recordStatus]}`}>{booking.recordStatus}</span></td><td className="px-3 py-3"><button onClick={() => setSelectedProfile(booking.tuteeId)} className="whitespace-nowrap rounded-xl bg-brand-600 px-4 py-2 text-xs font-bold text-white hover:bg-brand-700">View Profile</button></td><td className="px-3 py-3"><button onClick={() => setSelectedBooking(booking)} className="whitespace-nowrap rounded-xl bg-brand-600 px-4 py-2 text-xs font-bold text-white hover:bg-brand-700">View Details</button></td></tr>;
        })}</tbody></table></div>}
      </section>
    </> : <>
      <div className="mb-6 grid gap-4 sm:grid-cols-2">{[{ label: "Completed", value: completedAssessmentCount, tone: "bg-mint-100 text-mint-700", icon: CheckCircle2, filter: "Completed" }, { label: "Outdated", value: outdatedAssessmentCount, tone: "bg-red-100 text-red-600", icon: Clock3, filter: "Outdated" }].map(({ label, value, tone, icon: Icon, filter }) => <button key={label} onClick={() => setStatus(statusFilter === filter ? "All" : filter)} className={`rounded-3xl p-5 text-left shadow-sm ${tone}`}><Icon className="mb-2 h-9 w-9"/><span className="block text-sm font-bold">{label}</span><span className="text-3xl font-extrabold">{value}</span></button>)}</div>
      <section className="rounded-3xl bg-white p-4 shadow-sm sm:p-6"><div className="mb-4 flex items-center gap-3"><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search Tutee Name or Assessment ID..." className="rounded-2xl border-2 border-slate-300 px-5 py-3"/><button onClick={() => setFiltersOpen((open) => !open)} aria-label="Sort assessment records" className="rounded-xl p-2.5 text-brand-600 hover:bg-brand-50"><SlidersHorizontal className="h-5 w-5"/></button>{filtersOpen && <div className="absolute right-8 z-20 mt-28 w-56 rounded-xl border border-slate-200 bg-white p-3 shadow-xl">{[["name-asc", "Name A–Z"], ["name-desc", "Name Z–A"]].map(([value, label]) => <button key={value} onClick={() => setSortOrder(value)} className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${sortOrder === value ? "bg-brand-50 font-bold text-brand-700" : "hover:bg-slate-50"}`}>{label}</button>)}</div>}</div>
        <div className="mb-5 flex flex-wrap gap-2 rounded-full border-2 border-brand-500 p-1">{["All", "Completed", "Outdated"].map((value) => <button key={value} onClick={() => setStatus(value)} className={`min-w-24 flex-1 rounded-full px-3 py-2 text-sm font-bold ${statusFilter === value ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}>{value}</button>)}</div>
        {!assessmentRecords.length ? <Empty>No completed or outdated initial assessments match this filter.</Empty> : <div className="overflow-x-auto rounded-2xl"><table className="w-full min-w-[800px] text-left text-sm"><thead className="bg-slate-400 text-white"><tr>{["Name", "Scheduled Date", "Date Completed", "Status", "", ""].map((heading, index) => <th key={`${heading}-${index}`} className="px-4 py-3 font-bold">{heading}</th>)}</tr></thead><tbody>{assessmentRecords.map((assessment) => <tr key={assessment.id} className="border-b border-slate-300 bg-slate-50 last:border-0"><td className="px-4 py-3 font-semibold">{tuteeName(assessment.tuteeId)}<span className="block text-xs text-slate-500">{assessment.id}</span></td><td className="whitespace-nowrap px-4 py-3">{assessment.date ? fmtDate(assessment.date) : "—"}</td><td className="whitespace-nowrap px-4 py-3">{dateTime(assessment.completedAt || assessment.updatedAt || assessment.date || assessment.createdAt)}</td><td className="px-4 py-3"><span className={`inline-flex min-w-24 justify-center rounded-full px-3 py-1.5 text-xs font-bold ${statusTone[assessment.recordStatus]}`}>{assessment.recordStatus}</span></td><td className="px-3 py-3"><button onClick={() => setSelectedProfile(assessment.tuteeId)} className="whitespace-nowrap rounded-xl bg-brand-600 px-4 py-2 text-xs font-bold text-white hover:bg-brand-700">View Profile</button></td><td className="px-3 py-3"><button onClick={() => setSelectedAssessment(assessment)} className="whitespace-nowrap rounded-xl bg-brand-600 px-4 py-2 text-xs font-bold text-white hover:bg-brand-700">View Details</button></td></tr>)}</tbody></table></div>}
      </section>
    </>}

    <Modal open={!!selectedBooking} onClose={() => { setSelectedBooking(null); setScheduleOpen(false); }} title={selectedBooking ? `${selectedBooking.subject || "Booking"} · ${selectedBooking.modality === "face-to-face" ? "Face-to-Face" : "Online"}` : "Booking Details"} wide>
      {selectedBooking && <div className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><div className="rounded-2xl bg-slate-100 p-4"><h3 className="mb-3 border-b border-white pb-2 font-extrabold">Booking details</h3><dl className="space-y-2 text-sm text-slate-600"><InfoRow label="ID" value={selectedBooking.id}/><InfoRow label="Tutee" value={tuteeName(selectedBooking.tuteeId)}/><InfoRow label="Program" value={selectedBooking.program}/><InfoRow label="Session type" value={selectedBooking.sessionType || "One-on-one"}/><InfoRow label="Sessions" value={selectedBooking.sessionSlots?.length ?? selectedBooking.dates?.length ?? selectedBooking.sessions.length}/><InfoRow label="Amount" value={peso(selectedBooking.paymentAmount ?? selectedBooking.totalFee ?? 0)}/><InfoRow label="Date booked" value={dateTime(selectedBooking.createdAt || selectedBooking.at)}/></dl></div><div className="rounded-2xl border-2 border-slate-200 p-4"><h3 className="mb-3 border-b border-slate-200 pb-2 font-extrabold">Payment details</h3><dl className="space-y-2 text-sm text-slate-600"><InfoRow label="Method" value={selectedBooking.paymentProof?.method === "in_person" ? "In-person" : selectedBooking.paymentProof?.method === "online" ? "Online" : "—"}/><InfoRow label="Submitted" value={dateTime(selectedBooking.paymentProof?.submittedAt)}/><InfoRow label="Payment status" value={selectedBooking.paymentStatus || "—"}/></dl></div></div>
        {selectedBooking.paymentProof?.receiptData?.startsWith("data:image/") && <section className="rounded-2xl border border-slate-200 p-3"><h3 className="mb-2 font-extrabold">Submitted receipt</h3><Image src={selectedBooking.paymentProof.receiptData} alt="Submitted payment receipt" width={1600} height={1200} unoptimized className="mx-auto max-h-[50vh] max-w-full rounded-lg object-contain"/></section>}
        {selectedBooking.paymentProof?.receiptData?.startsWith("data:application/pdf") && <a href={selectedBooking.paymentProof.receiptData} target="_blank" rel="noreferrer" className="block rounded-xl bg-brand-600 px-4 py-3 text-center font-bold text-white">Open PDF Receipt</a>}
        <section className="overflow-hidden rounded-2xl border border-slate-200">
          <button type="button" aria-expanded={scheduleOpen} onClick={() => setScheduleOpen((open) => !open)} className="flex w-full items-center justify-between rounded-2xl bg-brand-600 px-5 py-4 text-left font-bold text-white hover:bg-brand-700"><span>View Schedule</span><ChevronDown className={`h-5 w-5 transition-transform ${scheduleOpen ? "rotate-180" : ""}`}/></button>
          {scheduleOpen && <div className="space-y-2 p-4">{scheduleRows(selectedBooking, s.db.cohorts).length ? scheduleRows(selectedBooking, s.db.cohorts).map((session) => {
            const tutor = s.db.tutors.find((entry) => entry.userId === session.tutorId);
            const tutorAccount = s.db.users.find((entry) => entry.id === session.tutorId);
            const sessionStatus = session.status === "completed" ? "Completed" : session.status === "cancelled" ? "Cancelled" : "Scheduled";
            return <div key={session.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 text-sm"><div><span className="font-bold">{session.subject || selectedBooking.subject || "Session"}</span><span className="ml-2 text-slate-600">{session.date ? fmtDate(session.date) : "Date not set"}{session.time ? ` · ${fmtTime(session.time)}` : ""}</span><span className="block text-xs text-slate-500">Tutor: {tutor?.fullName || tutorAccount?.username || "Unassigned"}</span></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${statusTone[sessionStatus]}`}>{sessionStatus}</span></div>;
          }) : <p className="text-sm text-slate-500">No schedule records available.</p>}</div>}
        </section>
        <div className="flex flex-wrap justify-between gap-2 px-1 text-xs font-semibold text-slate-400"><span>Approved on {approvedAt ? dateTime(approvedAt) : "—"}</span><span>Completed on {selectedBooking.completedAt ? dateTime(selectedBooking.completedAt) : "—"}</span></div>
      </div>}
    </Modal>
    <Modal open={!!selectedAssessment} onClose={() => setSelectedAssessment(null)} title="Initial Assessment Details">
      {selectedAssessment && <div className="space-y-4 text-sm text-slate-700"><div className="flex items-start justify-between gap-4"><div><h3 className="text-lg font-extrabold">Initial Assessment</h3><p className="font-semibold">{s.db.tutees.find((entry) => entry.userId === selectedAssessment.tuteeId)?.age ?? "—"} y/o · {selectedAssessment.modality === "face-to-face" ? "Face-to-Face" : "Online"}</p></div><span className={`rounded-full px-4 py-2 font-bold ${statusTone[selectedAssessment.recordStatus]}`}>{selectedAssessment.recordStatus}</span></div><p><b>Date completed:</b> {dateTime(selectedAssessment.completedAt || selectedAssessment.updatedAt || selectedAssessment.date || selectedAssessment.createdAt)}</p><p><b>Reading Level:</b> {selectedAssessment.readingLevel || "—"}</p><p><b>Assessment Result:</b> {selectedAssessment.results || "—"}</p><p><b>Learning Needs:</b> {selectedAssessment.learningNeeds || "—"}</p></div>}
    </Modal>
    {profile && <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/40 p-4" onClick={closeProfile}>
      <section role="dialog" aria-modal="true" aria-labelledby="booking-record-tutee-profile-title" className="my-auto w-full max-w-5xl rounded-3xl bg-white p-6 shadow-2xl sm:p-8" onClick={(event) => event.stopPropagation()}>
        <div className="mb-6 flex items-center justify-between"><h2 id="booking-record-tutee-profile-title" className="text-2xl font-extrabold text-slate-800">{profile.fullName || "Tutee"}</h2><button onClick={closeProfile} aria-label="Close profile" className="rounded-lg p-1 text-slate-600 hover:bg-slate-100"><span className="text-3xl leading-none">×</span></button></div>
        <div className="grid gap-x-8 gap-y-3 text-base text-slate-700 sm:grid-cols-2">
          <p><b>Birthday:</b> <span className="ml-1">{profile.birthday ? fmtDate(profile.birthday) : "—"}</span></p><p><b>Age:</b> <span className="ml-1">{profile.age ?? "—"}</span></p>
          <p><b>Grade:</b> <span className="ml-1">{profile.gradeLevel || "—"}</span></p><p><b>Guardian:</b> <span className="ml-1">{profile.guardianName || "—"}</span></p>
          <p><b>Contact:</b> <span className="ml-1">{profile.contact || "—"}</span></p><p><b>Last Enrolled:</b> <span className="ml-1">{latestCompletedSession?.date ? fmtDate(latestCompletedSession.date) : "---"}</span></p>
        </div>
        <div className="mt-5"><h3 className="mb-2 text-xl font-bold text-slate-700">Initial Assessment</h3>{profileAssessment ? <div className="space-y-1 text-base text-slate-700"><p><b>Reading Level:</b> <span className="ml-1">{profileAssessment.readingLevel || "—"}</span></p><p><b>Assessment Results:</b> <span className="ml-1">{profileAssessment.results || "—"}</span></p><p><b>Learning Needs:</b> <span className="ml-1">{profileAssessment.learningNeeds || "—"}</span></p></div> : <p className="text-sm text-slate-500">No assessment recorded.</p>}</div>
      </section>
    </div>}
  </>;
}

function InfoRow({ label, value }) {
  return <div className="flex justify-between gap-3"><dt>{label}</dt><dd className="text-right font-semibold capitalize">{value || "—"}</dd></div>;
}
