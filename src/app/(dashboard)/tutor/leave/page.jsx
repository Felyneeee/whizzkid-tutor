"use client";
import { useState } from "react";
import { Alert, Badge, Button, Card, Empty, Field, Input, PageHeader, Textarea } from "@/components/ui";
import { Calendar } from "@/components/Calendar";
import { fmtDate, todayISO } from "@/lib/dates";
import { useStore } from "@/lib/store";
export default function LeavePage() {
    const s = useStore();
    const id = s.me.id;
    const [dates, setDates] = useState([]);
    const [reason, setReason] = useState("");
    const [ok, setOk] = useState(false);
    const mine = s.db.leaves.filter((l) => l.tutorId === id).reverse();
    const affected = s.db.sessions.filter((x) => x.tutorId === id && x.status === "scheduled" && dates.includes(x.date)).length;
    return (<>
      <PageHeader title="Leave request" subtitle="Approved leaves block new bookings and flag any confirmed sessions for reassignment."/>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-4">
          <form className="space-y-4" onSubmit={(e) => {
            e.preventDefault();
            s.submitLeave(id, dates, reason);
            setDates([]);
            setReason("");
            setOk(true);
        }}>
            <Field label="Select leave dates" hint="Click each date you need off. Click a selected date again to remove it.">
              <Calendar selected={dates} initialMonth={todayISO()} onSelect={(date) => {
                setDates((current) => current.includes(date) ? current.filter((item) => item !== date) : [...current, date].sort());
                setOk(false);
              }}/>
              <div className="mt-2 text-sm font-bold text-slate-700">{dates.length ? `${dates.length} day${dates.length === 1 ? "" : "s"} selected: ${dates.map(fmtDate).join(", ")}` : "No dates selected"}</div>
            </Field>
            <Field label="Reason">
              <Textarea required value={reason} onChange={(e) => setReason(e.target.value)}/>
            </Field>
            {affected > 0 && <Alert kind="warn">{affected} confirmed session(s) fall on selected dates. If approved, the admin will reassign them.</Alert>}
            {ok && <Alert kind="success">Leave request submitted. Status: Pending Approval.</Alert>}
            <Button type="submit" disabled={!dates.length}>Submit leave request</Button>
          </form>
        </Card>
        <div className="space-y-2">
          <h2 className="font-extrabold">My leave requests</h2>
          {mine.length === 0 && <Empty>No leave requests.</Empty>}
          {mine.map((l) => (<Card key={l.id} className="!p-4">
              <div className="flex items-center justify-between">
                <div className="font-bold">
                  {l.dates ? l.dates.map(fmtDate).join(", ") : `${fmtDate(l.startDate)}${l.endDate !== l.startDate ? ` → ${fmtDate(l.endDate)}` : ""}`}
                </div>
                <Badge status={l.status}/>
              </div>
              <div className="text-sm text-slate-500">{l.reason}</div>
            </Card>))}
        </div>
      </div>
    </>);
}
