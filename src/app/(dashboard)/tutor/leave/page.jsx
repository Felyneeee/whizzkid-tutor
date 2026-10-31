"use client";
import { useState } from "react";
import { Alert, Badge, Button, Card, Empty, Field, Input, PageHeader, Textarea } from "@/components/ui";
import { addDays, fmtDate, todayISO } from "@/lib/dates";
import { useStore } from "@/lib/store";
export default function LeavePage() {
    const s = useStore();
    const id = s.me.id;
    const [start, setStart] = useState(addDays(todayISO(), 1));
    const [end, setEnd] = useState(addDays(todayISO(), 1));
    const [reason, setReason] = useState("");
    const [ok, setOk] = useState(false);
    const mine = s.db.leaves.filter((l) => l.tutorId === id).reverse();
    const affected = s.db.sessions.filter((x) => x.tutorId === id && x.status === "scheduled" && x.date >= start && x.date <= end).length;
    return (<>
      <PageHeader title="Leave request" subtitle="Approved leaves block new bookings and flag any confirmed sessions for reassignment."/>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-4">
          <form className="space-y-4" onSubmit={(e) => {
            e.preventDefault();
            s.submitLeave(id, start, end, reason);
            setReason("");
            setOk(true);
        }}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="From">
                <Input type="date" min={todayISO()} value={start} onChange={(e) => { setStart(e.target.value); if (end < e.target.value)
        setEnd(e.target.value); setOk(false); }} required/>
              </Field>
              <Field label="To">
                <Input type="date" min={start} value={end} onChange={(e) => { setEnd(e.target.value); setOk(false); }} required/>
              </Field>
            </div>
            <Field label="Reason">
              <Textarea required value={reason} onChange={(e) => setReason(e.target.value)}/>
            </Field>
            {affected > 0 && <Alert kind="warn">{affected} confirmed session(s) fall within these dates. If approved, the admin will reassign them.</Alert>}
            {ok && <Alert kind="success">Leave request submitted. Status: Pending Approval.</Alert>}
            <Button type="submit">Submit leave request</Button>
          </form>
        </Card>
        <div className="space-y-2">
          <h2 className="font-extrabold">My leave requests</h2>
          {mine.length === 0 && <Empty>No leave requests.</Empty>}
          {mine.map((l) => (<Card key={l.id} className="!p-4">
              <div className="flex items-center justify-between">
                <div className="font-bold">
                  {fmtDate(l.startDate)}
                  {l.endDate !== l.startDate && ` → ${fmtDate(l.endDate)}`}
                </div>
                <Badge status={l.status}/>
              </div>
              <div className="text-sm text-slate-500">{l.reason}</div>
            </Card>))}
        </div>
      </div>
    </>);
}
