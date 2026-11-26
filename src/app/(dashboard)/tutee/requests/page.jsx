"use client";
import { Info, UploadCloud } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Alert, Badge, Button, Empty, Field, Input, Modal, PageHeader, Select, Textarea, peso } from "@/components/ui";
import { HOURS } from "@/lib/constants";
import { fmtDate, fmtTime, todayISO, weekday, isAssessmentOutdated } from "@/lib/dates";
import { useStore } from "@/lib/store";

const TABS = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "approved", label: "Approved" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
];

function dateTime(value) {
  if (!value) return "Not yet available";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not yet available" : date.toLocaleString("en-PH", { dateStyle: "long", timeStyle: "short" });
}

const MAX_RECEIPT_BYTES = 560 * 1024;

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function prepareReceipt(file) {
  if (file.type === "application/pdf") {
    if (file.size > MAX_RECEIPT_BYTES) throw new Error("PDF receipts must be 560 KB or smaller. For a larger receipt, upload a photo or screenshot.");
    return readAsDataUrl(file);
  }
  if (!file.type.startsWith("image/")) throw new Error("Choose a JPG, PNG, WEBP, or PDF receipt.");
  if (typeof createImageBitmap !== "function") throw new Error("Could not process this photo. Save it as JPG or PNG and try again.");

  const bitmap = await createImageBitmap(file);
  try {
    let scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
    const qualities = [0.82, 0.72, 0.62, 0.52];
    for (let resize = 0; resize < 9; resize += 1) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      for (const quality of qualities) {
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
        if (blob && blob.size <= MAX_RECEIPT_BYTES) return await readAsDataUrl(blob);
      }
      scale *= 0.85;
    }
  } finally {
    bitmap.close();
  }
  throw new Error("Could not reduce this photo enough. Try a smaller or clearer screenshot.");
}

function TransferAccounts({ accounts = [] }) {
  if (!accounts.length) return <p className="rounded-xl bg-slate-100 p-4 text-sm font-semibold text-slate-600">Online transfer is not currently available.</p>;
  return <div className="grid gap-3 sm:grid-cols-2">
    {accounts.map((account) => <div key={account.id} className="rounded-2xl border-2 border-brand-500 bg-white p-4 text-slate-700"><h4 className="font-extrabold">{account.provider}</h4><p className="mt-2 font-semibold">Account Name: {account.accountName}</p><p className="text-sm font-semibold">Account Number: {account.accountNumber}</p></div>)}
  </div>;
}

export default function TuteeRequests() {
  const s = useStore();
  const id = s.me.id;
  const bookingRecords = s.db.bookings;
  const sessionRecords = s.db.sessions;
  const paymentSettings = s.db.paymentSettings || { onlineAccounts: [], onlineEnabled: true, inPersonEnabled: true, addresses: [] };
  const availablePaymentMethods = [
    ...(paymentSettings.onlineEnabled && paymentSettings.onlineAccounts?.length ? [{ id: "online", title: "Online Transfer", caption: "View available payment accounts." }] : []),
    ...(paymentSettings.inPersonEnabled && paymentSettings.addresses?.length ? [{ id: "in_person", title: "In-person Payment", caption: "Pay directly at the tutoring center." }] : []),
  ];
  const refreshSlotAvailability = s.refreshSlotAvailability;
  const [tab, setTab] = useState("pending");
  const [program, setProgram] = useState("academic");
  const [bookingModal, setBookingModal] = useState(null);
  const [reschedule, setReschedule] = useState(null);
  const [rescheduleError, setRescheduleError] = useState("");
  const [rescheduleBusy, setRescheduleBusy] = useState(false);
  const [rescheduleAvailability, setRescheduleAvailability] = useState({ key: "", available: {}, loading: false });
  useEffect(() => {
    if (!s.ready || !s.me) return;
    let active = true;
    void fetch("/api/state/action", { method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ action: "processPaymentDeadlines", args: [] }) })
      .then((response) => response.json())
      .then((payload) => {
        if (!active || !payload.db) return;
        const visibleBookingIds = new Set(payload.db.sessions.filter((session) => session.tuteeId === s.me.id).map((session) => session.bookingId));
        const visibleBookings = payload.db.bookings.filter((booking) => booking.tuteeId === s.me.id || visibleBookingIds.has(booking.id));
        const previousBookings = new Map(s.db.bookings.map((booking) => [booking.id, booking]));
        const changed = visibleBookings.some((booking) => {
          const previous = previousBookings.get(booking.id);
          return !previous || previous.status !== booking.status || previous.paymentStatus !== booking.paymentStatus;
        });
        if (changed) window.location.reload();
      }).catch(() => {});
    return () => { active = false; };
  }, [s.ready, s.me, s.db.bookings]);
  const [paymentDetails, setPaymentDetails] = useState({});
  const [bookingDetailsOpen, setBookingDetailsOpen] = useState({});
  const [receiptPreview, setReceiptPreview] = useState("");
  const [paymentMethod, setPaymentMethod] = useState({});
  const [receiptNames, setReceiptNames] = useState({});
  const [proofBusy, setProofBusy] = useState({});
  const [proofMessage, setProofMessage] = useState({});
  const [cancelMessage, setCancelMessage] = useState({});
  const [proposalMessage, setProposalMessage] = useState({});
  const statusOf = (booking) => String(booking.status || booking.bookingStatus || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  const isPlaygroup = (booking) => String(booking.program || "").toLowerCase() === "playgroup";
  const ownBookingIds = new Set(s.db.sessions.filter((session) => session.tuteeId === id).map((session) => session.bookingId));
  const isMyBooking = (booking) => booking.tuteeId === id || ownBookingIds.has(booking.id);

  useEffect(() => {
    if (!reschedule) { setRescheduleAvailability({ key: "", available: {}, loading: false }); return; }
    const booking = bookingRecords.find((entry) => entry.id === reschedule.bookingId);
    if (!booking) return;
    const selected = sessionRecords.filter((session) => session.bookingId === booking.id && reschedule.sessionIds.includes(session.id));
    const dates = [...new Set(selected.map((session) => reschedule.schedules[session.id]?.date).filter(Boolean))];
    const subjects = [...new Set(selected.map((session) => booking.sessionSlots?.find((slot) => slot.date === session.date && slot.time === session.time)?.subject || booking.sessionSubjects?.[session.date] || booking.subject || "English"))];
    if (!dates.length || !subjects.length) { setRescheduleAvailability({ key: "", available: {}, loading: false }); return; }
    const key = JSON.stringify([booking.id, dates, subjects, booking.program, booking.gradeLevel, booking.modality, booking.sessionType || "one-on-one"]);
    let stopped = false;
    const refresh = async () => {
      setRescheduleAvailability((current) => ({ ...current, key, loading: true }));
      const result = await refreshSlotAvailability({ bookingId: booking.id, dates, times: HOURS, subjects, program: booking.program, gradeLevel: booking.gradeLevel, modality: booking.modality, sessionType: booking.sessionType || "one-on-one" });
      if (!stopped) setRescheduleAvailability({ key, available: result.ok ? result.available : {}, loading: false });
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => { stopped = true; window.clearInterval(timer); };
  }, [reschedule, bookingRecords, sessionRecords, refreshSlotAvailability]);

  useEffect(() => {
    const signatureOf = (db) => JSON.stringify({
      paymentSettings: db?.paymentSettings,
      bookings: (db?.bookings || [])
        .filter((booking) => booking.tuteeId === id || (db.sessions || []).some((session) => session.tuteeId === id && session.bookingId === booking.id))
        .map((booking) => [booking.id, statusOf(booking), booking.paymentStatus || "", !!booking.rescheduleProposal, booking.dates || [], booking.sessionTimes || {}, booking.tutorAssignments || {}, booking.reassignmentPendingDates || {}, booking.scheduleHistory || [], booking.reassignmentHistory || []])
        .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
      sessions: (db?.sessions || [])
        .filter((session) => session.tuteeId === id)
        .map((session) => [session.id, session.date, session.time, session.tutorId, session.status, session.reassignmentHistory || []])
        .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    });
    const signature = signatureOf(s.db);
    const refreshIfChanged = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const response = await fetch("/api/state", { credentials: "same-origin", cache: "no-store" });
        if (!response.ok) return;
        const payload = await response.json();
        if (signatureOf(payload.db) !== signature) window.location.reload();
      } catch { /* Keep the current page if the refresh check cannot reach the server. */ }
    };
    const timer = window.setInterval(refreshIfChanged, 8000);
    const handleVisibility = () => { if (document.visibilityState === "visible") void refreshIfChanged(); };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [id, s.db, s.db.bookings, s.db.sessions]);

  const bookings = s.db.bookings.filter((booking) => isMyBooking(booking) && statusOf(booking)).slice().reverse();
  const readingAssessment = [...s.db.assessments].reverse().find((assessment) => assessment.tuteeId === id);
  const linkedAssessmentIds = new Set(bookings.filter((booking) => booking.program === "reading" && !["cancelled", "rejected", "expired", "terminated"].includes(statusOf(booking))).map((booking) => booking.assessmentId));
  const assessments = s.db.assessments.filter((assessment) => assessment.tuteeId === id && ["pending_admin_scheduling", "booked"].includes(assessment.status) && !linkedAssessmentIds.has(assessment.id));
  const sessionsFor = (booking) => s.db.sessions.filter((session) => session.bookingId === booking.id && session.status !== "cancelled");
  const fullyAssigned = (booking) => {
    const requested = booking.sessionSlots ?? (booking.dates || []).map((date) => ({ date, time: booking.sessionTimes?.[date] ?? booking.time }));
    const assigned = sessionsFor(booking);
    return requested.length > 0 && requested.every((slot) => assigned.some((session) => session.date === slot.date && session.time === slot.time && session.tutorId));
  };
  const paymentDueFor = (booking) => {
    const status = statusOf(booking);
    if (["cancelled", "rejected", "expired", "declined", "terminated", "awaiting_payment_approval", "awaiting_approval", "completed"].includes(status) || booking.paymentStatus === "paid" || booking.paymentStatus === "expired") return false;
    return status === "to_pay" || booking.paymentStatus === "to_pay" || ["confirmed", "approved"].includes(status) || fullyAssigned(booking);
  };
  const categoryOf = (booking) => {
    const status = statusOf(booking);
    if (["cancelled", "rejected", "expired", "declined", "terminated"].includes(status)) return "cancelled";
    if (paymentDueFor(booking) || ["awaiting_payment_approval", "awaiting_approval"].includes(status)) return "pending";
    if (status === "completed") return "completed";
    if (booking.paymentStatus === "paid" && !["cancelled", "rejected", "expired", "declined", "terminated"].includes(status)) return "approved";
    if (status === "approved" && isPlaygroup(booking)) return "approved";
    return "pending";
  };
  const programBookings = bookings.filter((booking) => (booking.program || "academic") === program);
  const filteredBookings = (tab === "all" ? programBookings : programBookings.filter((booking) => categoryOf(booking) === tab));
  const unreadBookingIds = new Set(s.db.notifications
    .filter((notification) => notification.userId === id && !notification.read && notification.threadId?.startsWith("booking:"))
    .map((notification) => notification.threadId.slice("booking:".length)));
  const newUpdateCount = (category) => programBookings.filter((booking) => (category === "all" || categoryOf(booking) === category) && unreadBookingIds.has(booking.id)).length;
  const programCounts = (key) => bookings.filter((booking) => (booking.program || "academic") === key && unreadBookingIds.has(booking.id)).length;

  const submitProof = async (bookingId, file, reference, method) => {
    if (!file) return setProofMessage((current) => ({ ...current, [bookingId]: "Choose a receipt file first." }));
    if (file.size > 5 * 1024 * 1024) return setProofMessage((current) => ({ ...current, [bookingId]: "Receipt must be 5 MB or smaller." }));
    setProofBusy((current) => ({ ...current, [bookingId]: true }));
    setProofMessage((current) => ({ ...current, [bookingId]: "" }));
    let receiptData;
    try {
      receiptData = await prepareReceipt(file);
    } catch (error) {
      setProofBusy((current) => ({ ...current, [bookingId]: false }));
      return setProofMessage((current) => ({ ...current, [bookingId]: error.message || "Could not process that receipt file." }));
    }
    if (!receiptData) {
      setProofBusy((current) => ({ ...current, [bookingId]: false }));
      return setProofMessage((current) => ({ ...current, [bookingId]: "Could not read that receipt file." }));
    }
    const response = await fetch("/api/state/action", { method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ action: "submitBookingPaymentProof", args: [bookingId, receiptData, reference, method] }) });
    const payload = await response.json().catch(() => ({}));
    setProofBusy((current) => ({ ...current, [bookingId]: false }));
    if (!response.ok) return setProofMessage((current) => ({ ...current, [bookingId]: payload.error || "Receipt could not be submitted." }));
    window.location.reload();
  };

  const cancelBooking = async (booking) => {
    const result = isPlaygroup(booking)
      ? await s.cancelPlaygroupBooking(booking.id)
      : await s.cancelTutorialBooking(booking.id);
    setCancelMessage((current) => ({ ...current, [booking.id]: result.ok ? "Request cancelled." : result.error || "Could not cancel this request." }));
  };

  const statusLabel = (booking) => {
    const status = statusOf(booking);
    if (paymentDueFor(booking)) return "To Pay";
    if (["awaiting_payment_approval", "awaiting_approval"].includes(status)) return "Awaiting Approval";
    if (categoryOf(booking) === "approved") return "Approved";
    if (categoryOf(booking) === "completed") return "Completed";
    if (categoryOf(booking) === "cancelled") return status === "expired" ? "Expired" : "Cancelled";
    if (status === "awaiting_admin" || status === "ready_for_matching" || status === "pending_assessment" || status === "assessment_scheduled" || status === "pending") return "Pending Request";
    return status.replace(/_/g, " ");
  };

  return <div className="space-y-6">
    <PageHeader title="My Bookings"/>
    <section className="space-y-4 rounded-3xl bg-white p-4 shadow-sm sm:p-6">
      <nav className="flex gap-1 overflow-x-auto rounded-2xl bg-slate-100 p-1" aria-label="Program category">
        {[{id:"academic",label:"Academic Program"},{id:"reading",label:"Reading Program"},{id:"playgroup",label:"Playgroup Program"}].map((item) => <button key={item.id} type="button" onClick={() => setProgram(item.id)} className={`shrink-0 rounded-xl px-3 py-2 text-sm font-bold ${program === item.id ? "bg-white text-brand-600 shadow-sm" : "text-slate-600"}`}>{item.label}{programCounts(item.id) > 0 && <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-extrabold text-white" aria-label={`${programCounts(item.id)} pending requests`}>{programCounts(item.id)}</span>}</button>)}
      </nav>
      {program === "reading" && readingAssessment && <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-lg sm:p-8" aria-label="Initial assessment">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><h2 className="text-xl font-extrabold text-slate-800">Initial Assessment</h2><p className="font-semibold text-slate-500">{readingAssessment.modality === "face-to-face" ? "Face-to-Face" : "Online"}</p></div>
          <span className={`min-w-36 rounded-xl px-4 py-3 text-center text-sm font-extrabold ${isAssessmentOutdated(readingAssessment) ? "bg-red-100 text-red-700" : readingAssessment.status === "completed" ? "bg-blue-100 text-blue-700" : readingAssessment.status === "booked" ? "bg-green-100 text-green-700" : "bg-slate-200 text-slate-600"}`}>{isAssessmentOutdated(readingAssessment) ? "Outdated" : readingAssessment.status === "completed" ? "Completed" : readingAssessment.status === "booked" ? "Scheduled" : "No Schedule"}</span>
        </div>
        <p className="mt-3 font-semibold text-slate-700"><b>Scheduled Date:</b> {readingAssessment.date ? `${fmtDate(readingAssessment.date)} at ${fmtTime(readingAssessment.time)}` : "N/A"}</p>
        <div className="mt-4 space-y-1 font-semibold text-slate-700"><p>Reading Level: <span className="text-slate-500">{readingAssessment.readingLevel || "N/A"}</span></p><p>Assessment Result: <span className="text-slate-500">{readingAssessment.results || "N/A"}</span></p><p>Learning Needs: <span className="text-slate-500">{readingAssessment.learningNeeds || "N/A"}</span></p></div>
        {readingAssessment.status !== "completed" && <p className="mt-4 flex items-start gap-3 text-sm font-semibold leading-6 text-slate-500"><Info className="mt-0.5 h-5 w-5 shrink-0 text-brand-600"/>Before we can assign a tutor, your child must attend the initial assessment. This helps us evaluate their current reading level and learning needs.</p>}
        {readingAssessment.status === "pending_admin_scheduling" && <p className="mt-4 text-center text-sm font-semibold text-slate-500">Waiting for the admin to schedule your initial assessment.</p>}
      </section>}
      {program === "reading" && readingAssessment?.status === "booked" && <p className="text-center text-sm font-semibold text-slate-500">No reading sessions yet? <Link href="/tutee/book?program=reading" className="font-extrabold text-brand-600 hover:underline">Book for a reading session <span aria-hidden="true">⟶</span></Link></p>}
      <div className="grid grid-cols-5 rounded-full border-2 border-brand-500 p-1 text-center text-xs font-bold sm:text-sm">
        {TABS.map((item) => { const count = newUpdateCount(item.id); return <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`inline-flex w-full items-center justify-center gap-1.5 rounded-full px-1 py-2 text-center transition sm:px-3 ${tab === item.id ? "bg-brand-600 text-white shadow-sm" : "text-slate-700 hover:bg-brand-50"}`}>{item.label}{count > 0 && <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-extrabold leading-none text-white" aria-label={`${count} new booking updates`}>{count}</span>}</button>; })}
      </div>

      {filteredBookings.length === 0
        ? <Empty>{tab === "all" ? "No bookings yet." : `No ${tab} bookings.`}</Empty>
        : <div className="space-y-4">
          {filteredBookings.map((booking) => {
            const status = statusOf(booking);
            const category = categoryOf(booking);
            const slots = booking.sessionSlots || (booking.dates || []).map((date) => ({ date, subject: booking.sessionSubjects?.[date] ?? booking.subject, time: booking.sessionTimes?.[date] ?? booking.time }));
            const bookingSessions = sessionsFor(booking);
            const pendingReassignment = bookingSessions.some((session) => session.status === "needs_reassignment") || Object.keys(booking.reassignmentPendingDates || {}).length > 0;
            const playgroupTutorIds = isPlaygroup(booking) ? (booking.dates || []).filter((date) => !booking.reassignmentPendingDates?.[date]).map((date) => booking.tutorAssignments?.[date] || s.db.cohorts.find((cohort) => cohort.id === booking.cohortId)?.weekdayTutorIds?.[weekday(date)] || booking.tutorId) : [];
            const assignedIds = [...new Set([...bookingSessions.filter((session) => session.status !== "needs_reassignment").map((session) => session.tutorId), ...playgroupTutorIds].filter(Boolean))];
            const tutors = assignedIds.map((tutorId) => s.db.tutors.find((tutor) => tutor.userId === tutorId)?.fullName).filter(Boolean);
            if (!tutors.length && booking.tutorId && !pendingReassignment) tutors.push(s.db.tutors.find((tutor) => tutor.userId === booking.tutorId)?.fullName || "Assigned");
            const scheduleUpdates = [
              ...(booking.scheduleHistory || []).map((entry) => `Rescheduled to ${fmtDate(entry.updated.date)} · ${fmtTime(entry.updated.time)}`),
              ...(booking.reassignmentHistory || bookingSessions.flatMap((session) => session.reassignmentHistory || [])).map((entry) => `Tutor reassigned to ${s.db.tutors.find((tutor) => tutor.userId === entry.newTutorId)?.fullName || "new tutor"} on ${fmtDate(entry.date)}`),
            ];
            const reassignmentHistory = booking.reassignmentHistory || bookingSessions.flatMap((session) => session.reassignmentHistory || []);
            const reassignedSessions = [
              ...bookingSessions.filter((session) => session.status === "needs_reassignment").map((session) => ({
                id: session.id,
                date: session.date,
                time: session.time,
                pending: true,
                tutorId: "",
              })),
              ...reassignmentHistory.map((entry, index) => ({
                id: `reassigned-${entry.sessionId || `${entry.date}-${entry.time}-${index}`}`,
                date: entry.date,
                time: entry.time,
                pending: false,
                tutorId: entry.newTutorId || "",
              })),
              ...(isPlaygroup(booking) ? (booking.dates || []).filter((date) => booking.reassignmentPendingDates?.[date]).map((date) => ({
                id: `playgroup-${booking.id}-${date}`,
                date,
                time: booking.sessionTimes?.[date] || booking.time || "10:00",
                pending: true,
                tutorId: "",
              })) : []),
              ...(isPlaygroup(booking) ? reassignmentHistory.filter((entry) => !entry.sessionId).map((entry, index) => ({
                id: `playgroup-reassigned-${booking.id}-${entry.date}-${index}`,
                date: entry.date,
                time: entry.time || booking.sessionTimes?.[entry.date] || booking.time || "10:00",
                pending: false,
                tutorId: entry.newTutorId || "",
              })) : []),
            ].sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
            const paidAt = booking.paymentProof?.submittedAt || booking.paymentApprovedAt;
            const dueAt = category === "cancelled" && !paidAt ? null : booking.paymentDeadlineAt || (booking.paymentStatus && booking.expiresAt);
            const paymentDue = paymentDueFor(booking);
            const detailsExpanded = bookingDetailsOpen[booking.id] ?? (status === "to_pay" || booking.paymentStatus === "to_pay");
            const selectedPaymentMethod = availablePaymentMethods.some((method) => method.id === paymentMethod[booking.id]) ? paymentMethod[booking.id] : availablePaymentMethods[0]?.id;
            const paymentReviewPending = ["awaiting_payment_approval", "awaiting_approval"].includes(status);
            const canCancel = !paymentReviewPending && (paymentDue || ["pending", "pending_assessment", "assessment_scheduled", "ready_for_matching", "awaiting_admin"].includes(status));
            const canReschedule = category === "approved" && !booking.rescheduleUsed && !(booking.scheduleHistory?.length > 0) && sessionsFor(booking).some((session) => session.status === "scheduled" && session.date >= todayISO());
            const hasPaymentRecord = paymentReviewPending || booking.paymentStatus === "paid" || !!booking.paymentApprovedAt;
            const detailSubjects = booking.subjects?.length ? booking.subjects.join(" · ") : booking.subject || "—";
            const slotSubjects = [...new Set((booking.sessionSlots || []).map((slot) => slot.subject).filter(Boolean))];
            const dateSubjects = [...new Set(Object.values(booking.sessionSubjects || {}).filter(Boolean))];
            const chosenSubjects = booking.subjects?.length
              ? booking.subjects
              : slotSubjects.length ? slotSubjects : dateSubjects.length ? dateSubjects : [booking.subject].filter(Boolean);
            const title = isPlaygroup(booking) ? `Playgroup · ${s.db.cohorts.find((cohort) => cohort.id === booking.cohortId)?.label || "Cohort"}` : booking.program === "reading" ? "Reading" : booking.program === "academic" ? chosenSubjects.join(" · ") || "Academic Booking" : `${booking.program || "Program"} Booking`;
            const bookingSubtitle = booking.program === "academic"
              ? `${booking.sessionType === "group" ? "Group" : "One-on-One"} · ${booking.modality}`
              : booking.program === "reading"
                ? `${booking.sessionType === "group" ? "Group" : "One-on-One"} · ${booking.modality === "face-to-face" ? "Face-to-Face" : "Online"}`
                : `${detailSubjects} · ${isPlaygroup(booking) ? "Cohort" : booking.sessionType === "group" ? "Group" : "One-on-One"} · ${booking.modality}`;
            const cycle = booking.cycleType === "1-month" ? "1 month" : booking.cycleType ? `${booking.cycleType} cycle` : "One-time";
            const assessment = booking.program === "reading" ? s.db.assessments.find((entry) => entry.id === booking.assessmentId) : null;
            const initialAssessmentText = assessment?.status === "booked" && assessment.date
              ? dateTime(`${assessment.date}T${assessment.time || "00:00"}:00`)
              : assessment?.status === "completed"
                ? isAssessmentOutdated(assessment) ? "Outdated · retake required" : "Completed"
                : "No schedule yet";
            const bookedAt = booking.createdAt || booking.at;
            const hasUnreadUpdate = unreadBookingIds.has(booking.id);
            const approvedAt = booking.paymentApprovedAt || booking.approvedAt;
            const cancelledAt = booking.cancelledAt || booking.terminatedAt || (status === "expired" ? booking.paymentDeadlineAt || booking.expiresAt : null);
            const bookingDetails = [
              ["Booking ID", booking.id],
              ["Requested cycle", cycle],
              ["Requested sessions", `${slots.length || booking.dates?.length || 0} sessions`],
              ["Assigned tutor", tutors.length ? `${tutors.join(" · ")}${pendingReassignment ? " · Reassignment pending" : ""}` : pendingReassignment ? "---" : "Not yet assigned"],
              ...(reassignedSessions.length ? [["Reassigned Sessions", reassignedSessions.map((session) => `${fmtDate(session.date)} · ${fmtTime(session.time)} — ${session.pending ? "Pending" : "Reassigned"} · New tutor: ${session.tutorId ? s.db.tutors.find((tutor) => tutor.userId === session.tutorId)?.fullName || "---" : "---"}`).join("; ")]] : []),
              ["Schedule updates", scheduleUpdates.length ? scheduleUpdates.join(" · ") : "No changes"],
              ["Amount due", peso(booking.paymentAmount ?? booking.totalFee ?? 0)],
            ];
            return <article key={booking.id} className="rounded-2xl border-2 border-slate-300 bg-white p-4 sm:p-6">
              <header className="flex flex-wrap items-start justify-between gap-3">
                <div><h2 className="text-lg font-extrabold">{title}</h2><p className="text-sm font-semibold text-slate-500">{bookingSubtitle}</p></div>
                <div className="flex flex-wrap items-center gap-2">
                  {canReschedule && <Button size="sm" variant="secondary" onClick={() => {
                    const proposal = booking.rescheduleProposal;
                    const proposedSessions = proposal?.sessions || (proposal ? [proposal] : []);
                    setReschedule({ bookingId: booking.id, sessionIds: proposedSessions.map((entry) => entry.sessionId), schedules: Object.fromEntries(proposedSessions.map((entry) => [entry.sessionId, { date: entry.date, time: entry.time }])), reason: proposal?.reason || "" });
                    setRescheduleError("");
                  }}>{booking.rescheduleProposal ? "Edit Reschedule" : "Reschedule"}</Button>}
                  {canCancel && <Button size="sm" variant="danger" onClick={() => cancelBooking(booking)}>Cancel Request</Button>}
                  <span className={`min-w-28 rounded-full px-3 py-2 text-center text-xs font-extrabold ${category === "approved" ? "bg-green-100 text-green-700" : category === "completed" ? "bg-blue-100 text-blue-700" : category === "cancelled" ? "bg-slate-200 text-slate-700" : paymentDue ? "bg-red-100 text-red-600" : paymentReviewPending ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>{statusLabel(booking)}</span>
                </div>
              </header>

              {reassignedSessions.length > 0 && <section className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm"><h3 className="font-extrabold text-amber-900">Reassigned Sessions</h3><div className="mt-2 space-y-1">{reassignedSessions.map((session) => <div key={session.id} className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-amber-900"><span>{fmtDate(session.date)} · {fmtTime(session.time)}</span><span className="font-semibold">{session.pending ? "Pending" : "Reassigned"} · New tutor: {session.tutorId ? s.db.tutors.find((tutor) => tutor.userId === session.tutorId)?.fullName || "---" : "---"}</span></div>)}</div></section>}

              {booking.program === "reading" && <p className="mt-3 text-sm font-semibold text-slate-700"><b>Initial Assessment:</b> <span className="text-slate-500">{initialAssessmentText}</span></p>}
              {paymentReviewPending && <p className="mt-3 flex items-start gap-2 text-xs font-semibold text-slate-500"><Info className="h-4 w-4 shrink-0 text-brand-600"/>Your confirmed schedule will appear in My Schedule once your payment is approved.</p>}

              {detailsExpanded ? <div className="mt-5 space-y-4"><div className="grid gap-4 md:grid-cols-2">
                <div className="overflow-hidden rounded-2xl bg-slate-100 text-sm text-slate-600 shadow-sm">
                  <h3 className="border-b-4 border-white px-5 py-3 text-base font-extrabold text-slate-800">Booking details</h3>
                  <dl className="space-y-2 px-5 py-4">{bookingDetails.map(([label, value]) => <div key={label} className="flex items-start justify-between gap-3"><dt className="font-semibold">{label}</dt><dd className="text-right">{value}</dd></div>)}</dl>
                </div>

                <div className="space-y-3">
                  <Button className="w-full rounded-2xl bg-brand-600 py-4 text-base" onClick={() => setBookingModal({ booking, type: "schedule" })}>{category === "approved" ? "View Schedule" : "View Requested Schedule"}</Button>
                  <div className="rounded-2xl border-2 border-slate-300 px-4 py-3 text-sm">
                    <div className="font-extrabold">Payment deadline</div><div className={dueAt && paymentDue ? "font-bold text-red-500" : "font-semibold text-slate-500"}>{dueAt ? dateTime(dueAt) : "Not yet available"}</div>
                    <div className="mt-2 font-extrabold">{paymentReviewPending ? "Proof submitted" : "Date paid"}</div><div className={paidAt ? "font-bold text-brand-600" : "font-semibold text-slate-500"}>{paidAt ? dateTime(paidAt) : "Not yet paid"}</div>
                  </div>
                </div>
              </div>

              {paymentDue && <div className="mt-4 space-y-4">
                {booking.paymentStatus === "proof_rejected" && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"><b>Payment receipt rejected.</b><p className="mt-1">Reason: {booking.paymentReviewNote || "Please contact the admin for details."}</p><p className="mt-1 font-semibold">Submit a new receipt within the updated payment deadline.</p></div>}
                <h3 className="text-lg font-extrabold">Choose Payment Method</h3>
                {availablePaymentMethods.length === 0 ? <p className="rounded-xl bg-amber-50 p-4 text-sm font-semibold text-amber-800">No payment methods are currently available. Please contact the tutoring center.</p> : <>
                <div className="grid gap-3 sm:grid-cols-2">
                  {availablePaymentMethods.map((method) => <button key={method.id} type="button" onClick={() => setPaymentMethod((current) => ({ ...current, [booking.id]: method.id }))} className={`rounded-2xl bg-slate-100 p-4 text-left ${ selectedPaymentMethod === method.id ? "ring-2 ring-brand-500" : "ring-1 ring-slate-200"}`}><span className="font-extrabold">{selectedPaymentMethod === method.id ? "◉" : "○"}　{method.title}</span><span className="mt-1 block pl-7 text-xs font-semibold text-slate-500">{method.caption}</span></button>)}
                </div>
                {selectedPaymentMethod === "online" ? <div className="space-y-3"><TransferAccounts accounts={paymentSettings.onlineAccounts}/><p className="text-sm font-semibold text-slate-500">Transfer the exact amount shown above, then upload your payment receipt or screenshot.</p></div> : <div className="space-y-3 rounded-2xl border-2 border-brand-500 p-4 text-sm text-slate-600"><p className="font-bold text-slate-800">Pay directly at one of these locations:</p>{paymentSettings.addresses.map((address) => <div key={address.id} className="rounded-xl bg-slate-50 p-3"><b>{address.buildingName}</b><p>{address.address}</p><p>Working hours: {address.workingHours}</p></div>)}<p>After payment, upload your receipt or payment record for admin verification.</p></div>}
                </>}
                <div className="space-y-3 rounded-2xl border border-dashed border-slate-400 p-4">
                  <div className="flex items-center gap-2 font-extrabold"><UploadCloud className="h-5 w-5 text-brand-600"/> Upload Payment Proof</div>
                  <label htmlFor={`receipt-${booking.id}`} className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 px-4 py-7 text-center hover:border-brand-400 hover:bg-brand-50/40">
                    <UploadCloud className="h-9 w-9 text-brand-600"/><span className="mt-2 font-extrabold">{receiptNames[booking.id] || "Upload your receipt or screenshot"}</span><span className="mt-1 text-xs font-semibold text-slate-500">Photos are optimized before upload · up to 5 MB. PDF up to 560 KB.</span><span className="mt-3 rounded-lg bg-brand-600 px-4 py-2 text-xs font-bold text-white">Browse files</span>
                  </label>
                  <Input className="sr-only" type="file" accept="image/png,image/jpeg,image/webp,application/pdf" id={`receipt-${booking.id}`} aria-label="Upload payment receipt" onChange={(event) => setReceiptNames((current) => ({ ...current, [booking.id]: event.target.files?.[0]?.name || "" }))}/>
                  <Field label="Payment reference (optional)"><Input id={`reference-${booking.id}`} maxLength={120}/></Field>
                  {proofMessage[booking.id] && <Alert kind="error">{proofMessage[booking.id]}</Alert>}
                  <Button className="w-full" disabled={!!proofBusy[booking.id] || !selectedPaymentMethod} onClick={() => submitProof(booking.id, document.getElementById(`receipt-${booking.id}`)?.files?.[0], document.getElementById(`reference-${booking.id}`)?.value, selectedPaymentMethod)}>{proofBusy[booking.id] ? "Submitting…" : "Submit payment proof"}</Button>
                </div>
                <p className="flex items-start gap-2 text-xs font-semibold text-slate-500"><Info className="h-4 w-4 shrink-0 text-brand-600"/>Your schedule appears in My Schedule after payment approval.</p>
              </div>}

              {paymentReviewPending && <div className="mt-4 space-y-3">
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm font-semibold text-blue-800">Payment proof submitted. Your booking is waiting for admin approval.</div>
                <Button variant="secondary" className="w-full bg-slate-200" onClick={() => setPaymentDetails((current) => ({ ...current, [booking.id]: !current[booking.id] }))}>{paymentDetails[booking.id] ? "Hide payment details" : "Show payment details"}</Button>
                {paymentDetails[booking.id] && <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600"><p>Payment method: <span className="font-bold">{booking.paymentProof?.method === "in_person" ? "In-person Payment" : "Online Transfer"}</span></p>{booking.paymentProof?.method === "in_person" ? <div className="space-y-2">{paymentSettings.addresses.map((address) => <div key={address.id} className="rounded-xl bg-white p-3"><b>{address.buildingName}</b><p>{address.address}</p><p>Working hours: {address.workingHours}</p></div>)}</div> : <><TransferAccounts accounts={paymentSettings.onlineAccounts}/><p>Transfer the exact amount shown above. Your submitted receipt is awaiting admin verification.</p></>}{booking.paymentProof?.reference && <p>Reference: {booking.paymentProof.reference}</p>}{booking.paymentProof?.submittedAt && <p>Submitted: {dateTime(booking.paymentProof.submittedAt)}</p>}{booking.paymentProof?.receiptData && <button type="button" className="inline-block font-bold text-brand-700 underline" onClick={() => setReceiptPreview(booking.paymentProof.receiptData)}>View payment receipt</button>}</div>}
                <p className="flex items-start gap-2 text-xs font-semibold text-slate-500"><Info className="h-4 w-4 shrink-0 text-brand-600"/>Your reservation stays active while the admin reviews your payment proof.</p>
              </div>}

              {hasPaymentRecord && !paymentReviewPending && <div className="mt-4 space-y-3">
                <Button variant="secondary" className="w-full bg-slate-200" onClick={() => setPaymentDetails((current) => ({ ...current, [booking.id]: !current[booking.id] }))}>{paymentDetails[booking.id] ? "Hide payment details" : "Show payment details"}</Button>
                {paymentDetails[booking.id] && <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600"><p>Payment status: <span className="font-bold capitalize">{String(booking.paymentStatus || "paid").replace(/_/g, " ")}</span></p><p className="mt-1">Amount paid: {peso(booking.paymentAmount ?? booking.totalFee ?? 0)}</p>{booking.paymentProof?.method && <p className="mt-1">Payment method: {booking.paymentProof.method === "in_person" ? "In-person Payment" : "Online Transfer"}</p>}{booking.paymentInstructions && <p className="mt-1">{booking.paymentInstructions}</p>}{booking.paymentProof?.reference && <p className="mt-1">Reference: {booking.paymentProof.reference}</p>}{booking.paymentProof?.receiptData && <button type="button" className="mt-2 inline-block font-bold text-brand-700 underline" onClick={() => setReceiptPreview(booking.paymentProof.receiptData)}>View payment receipt</button>}</div>}
              </div>}

              {(booking.rescheduleProposal || booking.scheduleHistory?.length > 0) && <section className="mt-4 space-y-3"><h3 className="font-extrabold">Reschedule Request</h3>{booking.rescheduleProposal && <div className="rounded-xl border border-slate-300 p-3 text-sm"><div className="flex flex-wrap justify-between gap-2"><b>{booking.subject || "Session"}</b><Badge status="pending">Pending Request</Badge></div><div className="mt-2 grid gap-2 sm:grid-cols-2"><div><span className="block text-xs font-bold text-slate-500">Current schedule</span>{fmtDate(booking.rescheduleProposal.original.date)} · {fmtTime(booking.rescheduleProposal.original.time)}<div className="text-xs text-slate-500">Tutor: {s.db.tutors.find((tutor) => tutor.userId === booking.rescheduleProposal.original.tutorId)?.fullName || "Assigned tutor"}</div></div><div className="font-semibold text-brand-700"><span className="block text-xs font-bold text-slate-500">Requested schedule</span>{fmtDate(booking.rescheduleProposal.date)} · {fmtTime(booking.rescheduleProposal.time)}<div className="text-xs">Tutor: ---</div></div></div><p className="mt-2 text-xs text-slate-500">You can edit this request until an admin reviews it. The original schedule remains active until approval.</p></div>}{(booking.scheduleHistory || []).map((entry, index) => <div key={`${booking.id}-history-${index}`} className="rounded-xl border border-slate-300 p-3 text-sm"><div className="flex flex-wrap justify-between gap-2"><b>{booking.subject || "Session"}</b><Badge status="approved">Approved</Badge></div><div className="mt-2 grid gap-2 sm:grid-cols-2"><div><span className="block text-xs font-bold text-slate-500">Previous schedule</span>{fmtDate(entry.old.date)} · {fmtTime(entry.old.time)}<div className="text-xs text-slate-500">Assigned Tutor: {s.db.tutors.find((tutor) => tutor.userId === entry.old.tutorId)?.fullName || "Assigned tutor"}</div></div><div className="font-semibold text-brand-700"><span className="block text-xs font-bold text-slate-500">Updated schedule</span>{fmtDate(entry.updated.date)} · {fmtTime(entry.updated.time)}<div className="text-xs">New Assigned Tutor: {s.db.tutors.find((tutor) => tutor.userId === entry.updated.tutorId)?.fullName || s.db.tutors.find((tutor) => tutor.userId === entry.old.tutorId)?.fullName || "Assigned tutor"}</div></div></div></div>)}</section>}
              {booking.scheduleProposal?.sessions && <div className="mt-4 space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
                <b>The admin proposed a schedule change. Review it:</b><p>{booking.scheduleProposal.sessions.map((session) => `${fmtDate(session.date)} at ${fmtTime(session.time)}`).join(" · ")}</p>
                <div className="flex flex-wrap gap-2"><Button size="sm" onClick={async () => { const result = await s.decideBookingScheduleProposal(booking.id, true); setProposalMessage((current) => ({ ...current, [booking.id]: result.ok ? "Schedule approved." : result.error })); }}>Approve schedule</Button><Button size="sm" variant="secondary" onClick={async () => { const result = await s.decideBookingScheduleProposal(booking.id, false); setProposalMessage((current) => ({ ...current, [booking.id]: result.ok ? "Original schedule kept." : result.error })); }}>Decline</Button></div>
              </div>}
              {proposalMessage[booking.id] && <p className="mt-3 text-sm text-slate-600">{proposalMessage[booking.id]}</p>}
              <Button variant="secondary" className="w-full bg-slate-200" onClick={() => setBookingDetailsOpen((current) => ({ ...current, [booking.id]: false }))}>Hide Details</Button>
              </div> : <Button variant="secondary" className="mt-5 w-full bg-slate-200" onClick={async () => { if (hasUnreadUpdate) await s.markBookingNotificationsRead(booking.id); setBookingDetailsOpen((current) => ({ ...current, [booking.id]: true })); }}>{hasUnreadUpdate ? "Show details · View update" : "Show details"}</Button>}
              {cancelMessage[booking.id] && <p className="mt-3 text-sm text-slate-600">{cancelMessage[booking.id]}</p>}
              <footer className="mt-4 flex flex-wrap justify-between gap-2 px-1 text-xs font-semibold text-slate-400">
                <span>Booked on {bookedAt ? dateTime(bookedAt) : "—"}</span>
                {category === "approved" && <span className="text-green-700">Approved on {approvedAt ? dateTime(approvedAt) : "—"}</span>}
                {category === "completed" && <span className="text-blue-700">Completed on {booking.completedAt ? dateTime(booking.completedAt) : "—"}</span>}
                {category === "cancelled" && <span className="text-red-600">Cancelled on {cancelledAt ? dateTime(cancelledAt) : "—"}</span>}
              </footer>
            </article>;
          })}
        </div>}
    </section>

    <Modal open={!!reschedule} onClose={() => setReschedule(null)} title="Request Schedule Change">
      {reschedule && (() => {
        const booking = s.db.bookings.find((entry) => entry.id === reschedule.bookingId);
        const sessions = sessionsFor(booking || {}).filter((session) => session.status === "scheduled" && session.date >= todayISO());
        const selectedSessions = sessions.filter((session) => reschedule.sessionIds.includes(session.id));
        return <div className="space-y-4">
          <p className="font-semibold text-slate-600">Select the session you want to reschedule.</p>
          <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">
            {sessions.map((session) => {
              const subject = booking?.sessionSlots?.find((slot) => slot.date === session.date && slot.time === session.time)?.subject || booking?.sessionSubjects?.[session.date] || booking?.subject || "Session";
              const active = reschedule.sessionIds.includes(session.id);
              const schedule = reschedule.schedules[session.id] || { date: "", time: "" };
              const availabilityTimes = schedule.date ? HOURS.filter((time) => rescheduleAvailability.available[`${schedule.date}|${time}|${subject}`] === true) : [];
              return <div key={session.id} className={`rounded-2xl border-2 p-4 ${active ? "border-brand-500" : "border-slate-300"}`}>
                <button type="button" className="flex w-full items-start gap-3 text-left" onClick={() => setReschedule((current) => ({ ...current, sessionIds: active ? current.sessionIds.filter((id) => id !== session.id) : [...current.sessionIds, session.id] }))}>
                  <span className={`mt-1 h-5 w-5 shrink-0 rounded-full border-2 ${active ? "border-brand-600 bg-brand-600 ring-2 ring-brand-200" : "border-slate-400"}`}/>
                  <span><b className="block text-lg">{subject}</b><span className="text-sm font-semibold text-slate-500">{fmtDate(session.date)} · {fmtTime(session.time)}</span></span>
                </button>
                {active && <div className="mt-4 space-y-3">
                  <h3 className="text-lg font-extrabold">New Schedule</h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Preferred date"><Input type="date" min={todayISO()} value={schedule.date} onChange={(event) => setReschedule((current) => ({ ...current, schedules: { ...current.schedules, [session.id]: { ...current.schedules[session.id], date: event.target.value, time: "" } } }))}/></Field>
                    <Field label="Preferred time"><Select value={schedule.time} onChange={(event) => setReschedule((current) => ({ ...current, schedules: { ...current.schedules, [session.id]: { ...current.schedules[session.id], time: event.target.value } } }))}><option value="">{!schedule.date ? "Choose a date first" : rescheduleAvailability.loading ? "Checking open times…" : availabilityTimes.length ? "Select an available time" : "No available times"}</option>{availabilityTimes.map((time) => <option key={time} value={time}>{fmtTime(time)}</option>)}</Select></Field>
                  </div>
                </div>}
              </div>;
            })}
          </div>
          <Field label="Reason for rescheduling"><Textarea placeholder="Type a message..." value={reschedule.reason} onChange={(event) => setReschedule((current) => ({ ...current, reason: event.target.value }))}/></Field>
          <p className="text-xs font-semibold text-slate-500">Only the sessions you select will be rescheduled. Every unselected session stays on its current schedule. Your original schedule remains confirmed until the admin approves the change.</p>
          {rescheduleError && <Alert kind="error">{rescheduleError}</Alert>}
          <Button className="w-full" disabled={rescheduleBusy || !selectedSessions.length || selectedSessions.some((session) => !reschedule.schedules[session.id]?.date || !reschedule.schedules[session.id]?.time) || !reschedule.reason.trim()} onClick={async () => {
            setRescheduleBusy(true);
            const requests = selectedSessions.map((session) => ({ sessionId: session.id, ...reschedule.schedules[session.id] }));
            const response = await fetch("/api/state/action", { method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ action: "requestBookingReschedule", args: [reschedule.bookingId, requests, reschedule.reason.trim()] }) });
            const payload = await response.json().catch(() => ({}));
            setRescheduleBusy(false);
            if (!response.ok) return setRescheduleError(payload.error || "Could not submit the reschedule request.");
            window.location.reload();
          }}>{rescheduleBusy ? "Submitting…" : "Submit Reschedule Request"}</Button>
        </div>;
      })()}
    </Modal>

    <Modal open={!!bookingModal} onClose={() => setBookingModal(null)} title={bookingModal?.type === "schedule" ? "Booking schedule" : "Booking details"}>
      {bookingModal && (() => {
        const booking = bookingModal.booking;
        const slots = booking.sessionSlots || (booking.dates || []).map((date) => ({ date, time: booking.sessionTimes?.[date] ?? booking.time, subject: booking.sessionSubjects?.[date] ?? booking.subject }));
        const category = categoryOf(booking);
        const actualSessions = s.db.sessions.filter((session) => session.bookingId === booking.id);
        const sessionStatus = (slot, index) => {
          if (category === "cancelled") return "Cancelled";
          if (category === "completed") return "Completed";
          if (category === "pending") return "Pending";
          const session = actualSessions.find((entry) => entry.date === slot.date && entry.time === slot.time) || actualSessions[index];
          return session?.status === "completed" ? "Completed" : session?.status === "cancelled" ? "Cancelled" : "Scheduled";
        };
        const completedCount = category === "completed" ? slots.length : slots.filter((slot, index) => sessionStatus(slot, index) === "Completed").length;
        const scheduleBadge = (value) => value === "Completed" ? "bg-blue-100 text-blue-700" : value === "Scheduled" ? "bg-green-100 text-green-700" : value === "Cancelled" ? "bg-slate-200 text-slate-700" : "bg-amber-100 text-amber-700";
        return <div className="space-y-3 text-sm">
          {bookingModal.type === "schedule" ? <>
            <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-lg font-extrabold text-slate-800">{booking.program === "playgroup" ? "Playgroup" : booking.subject || booking.program} · {completedCount}/{slots.length} Completed Sessions</h3></div><span className={`rounded-full px-4 py-2 text-center text-xs font-extrabold ${category === "completed" ? "bg-blue-100 text-blue-700" : category === "approved" ? "bg-green-100 text-green-700" : category === "cancelled" ? "bg-slate-200 text-slate-700" : "bg-amber-100 text-amber-700"}`}>{statusLabel(booking)}</span></div>
            <div className="max-h-[60vh] space-y-2 overflow-y-auto">{slots.map((slot, index) => { const value = sessionStatus(slot, index); return <div key={`${slot.date}-${slot.time}-${index}`} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2"><span className="min-w-0">{fmtDate(slot.date)} · {slot.subject || booking.subject || "Session"} · {fmtTime(slot.time)}</span><span className={`shrink-0 rounded-lg px-3 py-2 text-center text-xs font-extrabold ${scheduleBadge(value)}`}>{value}</span></div>; })}</div>
          </> : <>
            <div className="flex items-center justify-between gap-3"><span className="font-bold">{booking.program === "playgroup" ? "Playgroup" : booking.subject}</span><Badge status={statusOf(booking)}>{statusLabel(booking)}</Badge></div>
            <p>{booking.modality} · {peso(booking.totalFee)}</p>
            <p>Tutor: {[...new Set(sessionsFor(booking).map((session) => session.tutorId).filter(Boolean))].map((tutorId) => s.db.tutors.find((tutor) => tutor.userId === tutorId)?.fullName || "Assigned").join(" · ") || "Not yet assigned"}</p>
            {booking.scheduleHistory?.length > 0 && <div><b>Schedule history</b>{booking.scheduleHistory.map((entry, index) => <p key={index}>From {fmtDate(entry.old.date)} at {fmtTime(entry.old.time)} to {fmtDate(entry.updated.date)} at {fmtTime(entry.updated.time)}</p>)}</div>}
          </>}
        </div>;
      })()}
    </Modal>
    <Modal open={!!receiptPreview} onClose={() => setReceiptPreview("")} title="Payment receipt" wide>
      {receiptPreview?.startsWith("data:image/") ? <Image src={receiptPreview} alt="Payment receipt" width={1600} height={1200} unoptimized className="mx-auto max-h-[75vh] max-w-full rounded-lg object-contain"/> : receiptPreview?.startsWith("data:application/pdf") ? <iframe title="Payment receipt PDF" src={receiptPreview} className="h-[75vh] w-full rounded-lg border"/> : <p className="text-sm text-slate-600">Receipt unavailable.</p>}
    </Modal>
  </div>;
}
