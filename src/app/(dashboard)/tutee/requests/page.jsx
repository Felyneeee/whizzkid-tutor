"use client";
import { useState } from "react";
import { Alert, Badge, Button, Card, Empty, PageHeader, peso } from "@/components/ui";
import { fmtDate, fmtTime } from "@/lib/dates";
import { useStore } from "@/lib/store";
export default function TuteeRequests() {
    const s = useStore();
    const [proposalMsg, setProposalMsg] = useState({});
    const id = s.me.id;
    const bookings = s.db.bookings.filter((b) => b.tuteeId === id && (["awaiting_admin", "rejected", "cancelled", "expired"].includes(b.status) || !!b.scheduleProposal)).reverse();
    const assessments = s.db.assessments.filter((a) => a.tuteeId === id && ["pending_admin_scheduling", "booked"].includes(a.status));
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
            </div>
            <div className="flex items-center gap-2">
              <Badge status={a.status}>{a.status === "pending_admin_scheduling" ? "Pending Admin Assessment Scheduling" : "Scheduled"}</Badge>
            </div>
          </Card>))}
        {bookings.map((b) => (<Card key={b.id} className="!p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-extrabold">
                  {b.subject} · {b.bookingType}
                </div>
                <div className="text-sm text-slate-500">
                  {(b.sessionSlots?.length ?? b.dates.length)} session(s) · {(b.sessionSlots || b.dates.map((date) => ({ date, subject: b.sessionSubjects?.[date], time: b.sessionTimes?.[date] ?? b.time }))).map((slot) => `${fmtDate(slot.date)} ${slot.subject ? `(${slot.subject}) ` : ""}at ${fmtTime(slot.time)}`).join(" · ")} · {b.modality} · {peso(b.totalFee)}
                </div>
              </div>
              <Badge status={b.status}/>
              {b.status === "awaiting_admin" && <Button size="sm" variant="secondary" onClick={() => s.cancelTutorialBooking(b.id)}>Cancel request</Button>}
            </div>
            {b.status === "awaiting_admin" && !b.scheduleProposal && <p className="mt-2 text-xs text-slate-500">Your slot is reserved while the admin reviews your request and finds a matching tutor.</p>}
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
            {proposalMsg[b.id] && <div className="mt-3"><Alert kind={proposalMsg[b.id].kind}>{proposalMsg[b.id].text}</Alert></div>}
            {b.status === "rejected" && <p className="mt-2 text-xs text-coral-600">{b.terminationReason} Please book a new schedule.</p>}
            {b.status === "expired" && <p className="mt-2 text-xs text-coral-600">This request expired and its temporary capacity reservation was released.</p>}
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
