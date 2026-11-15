"use client";
import { useEffect, useState } from "react";
import { Alert, Badge, Button, Card, Empty, PageHeader, peso } from "@/components/ui";
import { fmtDate, fmtTime } from "@/lib/dates";
import { useStore } from "@/lib/store";
export default function TuteeRequests() {
    const s = useStore();
    const [proposalMsg, setProposalMsg] = useState({});
    const [cancelMsg, setCancelMsg] = useState({});
    const id = s.me.id;
    const statusOf = (booking) => String(booking.status || booking.bookingStatus || "").toLowerCase();
    const isPlaygroup = (booking) => String(booking.program || "").toLowerCase() === "playgroup";
    useEffect(() => {
      const signatureOf = (bookings) => JSON.stringify((bookings || [])
        .filter((booking) => booking.tuteeId === id && isPlaygroup(booking))
        .map((booking) => [booking.id, booking.cohortId || "", statusOf(booking)])
        .sort((a, b) => String(a[0]).localeCompare(String(b[0]))));
      const signature = signatureOf(s.db.bookings);
      const refreshIfChanged = async () => {
        if (document.visibilityState !== "visible") return;
        try {
          const response = await fetch("/api/state", { credentials: "same-origin", cache: "no-store" });
          if (!response.ok) return;
          const payload = await response.json();
          if (signatureOf(payload.db?.bookings) !== signature) window.location.reload();
        } catch { /* Keep the current page if the refresh check cannot reach the server. */ }
      };
      const timer = window.setInterval(refreshIfChanged, 8000);
      const handleVisibility = () => { if (document.visibilityState === "visible") void refreshIfChanged(); };
      document.addEventListener("visibilitychange", handleVisibility);
      return () => {
        window.clearInterval(timer);
        document.removeEventListener("visibilitychange", handleVisibility);
      };
    }, [id, s.db.bookings]);
    const bookings = s.db.bookings.filter((b) => b.tuteeId === id && (["pending_assessment", "assessment_scheduled", "ready_for_matching", "awaiting_admin", "rejected", "cancelled", "expired"].includes(statusOf(b)) || (String(b.program || "").toLowerCase() === "reading" && statusOf(b) === "pending") || (isPlaygroup(b) && ["pending", "awaiting_admin", "approved", "confirmed", "declined"].includes(statusOf(b))) || !!b.scheduleProposal)).reverse();
    const linkedAssessmentIds = new Set(s.db.bookings.filter((b) => b.tuteeId === id && b.program === "reading" && ["pending", "pending_assessment", "assessment_scheduled"].includes(b.status)).map((b) => b.assessmentId));
    const assessments = s.db.assessments.filter((a) => a.tuteeId === id && ["pending_admin_scheduling", "booked"].includes(a.status) && !linkedAssessmentIds.has(a.id));
    const orders = s.db.purchases.filter((p) => p.tuteeId === id && p.status === "pending");
    return (<>
      <PageHeader title="Pending requests" subtitle="Everything waiting on admin review."/>
      {bookings.length + assessments.length + orders.length === 0 && <Empty>No pending requests.</Empty>}
      <div className="space-y-3">
        {assessments.map((a) => (<Card key={a.id} className="flex flex-wrap items-center justify-between gap-2 !p-4">
            <div>
              <div className="font-extrabold">Reading program request · Initial assessment</div>
              <div className="text-sm text-slate-500">
                {a.date ? `${fmtDate(a.date)} · ${fmtTime(a.time)}` : "The admin will schedule and send your assessment details"} · {a.modality}
              </div>
              <div className="mt-1 text-xs text-slate-500">The initial assessment is scheduled by the admin between 9:00 and 10:00 AM. After the admin records the results, they will match a tutor to your selected schedule.</div>
            </div>
            <div className="flex items-center gap-2">
              <Badge status={a.status}>{a.status === "pending_admin_scheduling" ? "Pending Admin Assessment Scheduling" : "Scheduled"}</Badge>
            </div>
          </Card>))}
        {bookings.map((b) => (<Card key={b.id} className="!p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-extrabold">
                  {isPlaygroup(b) ? `Playgroup · ${s.db.cohorts.find((cohort) => cohort.id === b.cohortId)?.label || "cohort"}` : `${b.subject} · ${b.cycleType === "1-month" ? "4-week cycle" : b.cycleType ? `${b.cycleType} cycle` : "schedule"}`}
                </div>
                <div className="text-sm text-slate-500">
                  {isPlaygroup(b)
                    ? `${b.dates.length} sessions · ${fmtDate(b.dates[0])} to ${fmtDate(b.dates[b.dates.length - 1])} · Monday/Wednesday/Friday · ${fmtTime(b.time || "10:00")} · ${b.modality} · ${peso(b.totalFee)}`
                    : `${(b.sessionSlots?.length ?? b.dates.length)} session(s) · ${(b.sessionSlots || b.dates.map((date) => ({ date, subject: b.sessionSubjects?.[date], time: b.sessionTimes?.[date] ?? b.time }))).map((slot) => `${fmtDate(slot.date)} ${slot.subject ? `(${slot.subject}) ` : ""}at ${fmtTime(slot.time)}`).join(" · ")} · ${b.modality} · ${peso(b.totalFee)}`}
                </div>
              </div>
              <Badge status={statusOf(b)}>{(statusOf(b) === "pending_assessment" || (String(b.program || "").toLowerCase() === "reading" && statusOf(b) === "pending")) ? s.db.assessments.find((a) => a.id === b.assessmentId)?.status === "booked" ? "Awaiting assessment results" : "Awaiting initial assessment" : isPlaygroup(b) && ["pending", "awaiting_admin"].includes(statusOf(b)) ? "Pending approval" : undefined}</Badge>
              {["pending_assessment", "assessment_scheduled", "ready_for_matching", "awaiting_admin"].includes(statusOf(b)) || (String(b.program || "").toLowerCase() === "reading" && statusOf(b) === "pending") ? <Button size="sm" variant="secondary" onClick={() => s.cancelTutorialBooking(b.id)}>Cancel request</Button> : null}
              {isPlaygroup(b) && ["pending", "approved", "confirmed", "awaiting_admin"].includes(statusOf(b)) && <Button size="sm" variant="secondary" onClick={async () => {
                const result = await s.cancelPlaygroupBooking(b.id);
                setCancelMsg((current) => ({ ...current, [b.id]: { kind: result.ok ? "success" : "error", text: result.ok ? "Playgroup booking cancelled. The cohort slot has been released." : result.error } }));
              }}>Cancel Playgroup booking</Button>}
            </div>
            {isPlaygroup(b) && <div className="mt-2 text-xs text-slate-600">Booking: {statusOf(b)} · Tutor: {b.tutorAssignmentStatus || (b.tutorId ? "Assigned" : "Unassigned")}{b.tutorId ? ` (${s.db.tutors.find((t) => t.userId === b.tutorId)?.fullName || "Tutor"})` : ""}</div>}
            {b.scheduleProposal && (<div className="mt-3 space-y-3 rounded-xl border border-sunny-200 bg-sunny-50 p-3">
                <div className="font-bold">The admin proposed a schedule change. Please review it:</div>
                <div className="text-sm">{b.scheduleProposal.sessions.map((session) => `${fmtDate(session.date)} at ${fmtTime(session.time)}`).join(" · ")}</div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={async () => {
                    const result = await s.decideBookingScheduleProposal(b.id, true);
                    setProposalMsg((current) => ({ ...current, [b.id]: { text: result.ok ? "Schedule approved. The admin will now match a tutor." : result.error, kind: result.ok ? "success" : "error" } }));
                }}>Approve schedule</Button>
                  <Button size="sm" variant="secondary" onClick={async () => {
                    const result = await s.decideBookingScheduleProposal(b.id, false);
                    setProposalMsg((current) => ({ ...current, [b.id]: { text: result.ok ? "Schedule declined. The admin has been notified." : result.error, kind: result.ok ? "success" : "error" } }));
                }}>Decline</Button>
                </div>
              </div>)}
            {cancelMsg[b.id] && <div className="mt-3"><Alert kind={cancelMsg[b.id].kind}>{cancelMsg[b.id].text}</Alert></div>}
            {proposalMsg[b.id] && <div className="mt-3"><Alert kind={proposalMsg[b.id].kind}>{proposalMsg[b.id].text}</Alert></div>}
          </Card>))}
        {orders.map((o) => (<Card key={o.id} className="flex items-center justify-between !p-4">
            <div>
              <div className="font-extrabold">Purchase order</div>
              <div className="text-sm text-slate-500">{o.items.map((i) => `${i.qty}× ${i.name}`).join(", ")} · {peso(o.total)}</div>
            </div>
            <Badge status="pending"/>
          </Card>))}
      </div>
    </>);
}
