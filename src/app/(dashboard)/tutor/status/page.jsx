"use client";
import { useState } from "react";
import { Badge, Card, Empty, PageHeader, Tabs } from "@/components/ui";
import { fmtDate, fmtDateTime } from "@/lib/dates";
import { useStore } from "@/lib/store";
export default function RequestStatus() {
    const s = useStore();
    const id = s.me.id;
    const [tab, setTab] = useState("availability");
    const av = s.db.availability.filter((a) => a.tutorId === id);
    const batches = Array.from(new Set(av.map((a) => a.batchId))).reverse();
    const leaves = s.db.leaves.filter((l) => l.tutorId === id).reverse();
    return (<>
      <PageHeader title="Request status" subtitle="Track approvals for availability changes and leave."/>
      <Tabs tabs={[
            { id: "availability", label: "Availability", count: av.filter((a) => a.status === "pending").length },
            { id: "leave", label: "Leave", count: leaves.filter((l) => l.status === "pending").length },
        ]} value={tab} onChange={setTab}/>
      {tab === "availability" ? (batches.length === 0 ? (<Empty>No submissions.</Empty>) : (<div className="space-y-2">
            {batches.map((b) => {
                const recs = av.filter((a) => a.batchId === b);
                const st = recs.some((r) => r.status === "pending") ? "pending" : recs[0].status;
                return (<Card key={b} className="!p-4">
                  <div className="flex items-center justify-between">
                    <div className="font-bold">{recs.length} day(s) · submitted {fmtDateTime(recs[0].submittedAt)}</div>
                    <Badge status={st}/>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">{recs.slice(0, 6).map((r) => `${fmtDate(r.date)} (${r.slots.length}h)`).join(" · ")}{recs.length > 6 && " …"}</div>
                  {recs[0].note && <div className="mt-1 text-xs text-slate-400">{recs[0].note}</div>}
                </Card>);
            })}
          </div>)) : leaves.length === 0 ? (<Empty>No leave requests.</Empty>) : (<div className="space-y-2">
          {leaves.map((l) => (<Card key={l.id} className="flex items-center justify-between !p-4">
              <div>
                <div className="font-bold">
                  {fmtDate(l.startDate)} → {fmtDate(l.endDate)}
                </div>
                <div className="text-sm text-slate-500">{l.reason}</div>
              </div>
              <Badge status={l.status}/>
            </Card>))}
        </div>)}
    </>);
}
