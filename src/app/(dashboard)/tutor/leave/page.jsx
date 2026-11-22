"use client";
import { useState } from "react";
import { Alert, Badge, Button, Card, Empty, Field, Input, Modal, PageHeader, Select, Textarea } from "@/components/ui";
import { fmtDate, todayISO } from "@/lib/dates";
import { useStore } from "@/lib/store";

const LEAVE_TYPES = ["Annual Leave", "Bereavement", "Maternity Leave", "Sick Leave", "Unpaid Leave", "Parental Leave", "Other"];
const leaveStart = (leave) => leave.startDate || leave.dates?.[0] || "";
const leaveEnd = (leave) => leave.endDate || leave.dates?.[leave.dates.length - 1] || leaveStart(leave);
const displayDate = (date) => date ? fmtDate(String(date).slice(0, 10)) : "—";
const dateList = (from, to) => {
  const out = [];
  for (let date = new Date(`${from}T12:00:00`), end = new Date(`${to}T12:00:00`); date <= end; date.setDate(date.getDate() + 1)) out.push(`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`);
  return out;
};

export default function LeavePage() {
  const s = useStore();
  const id = s.me.id;
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [leaveType, setLeaveType] = useState("");
  const [otherReason, setOtherReason] = useState("");
  const [note, setNote] = useState("");
  const [signature, setSignature] = useState(s.me.name || "");
  const [ok, setOk] = useState(false);
  const [viewLeave, setViewLeave] = useState(null);
  const mine = s.db.leaves.filter((l) => l.tutorId === id).slice().reverse();
  const dates = from && to && from <= to ? dateList(from, to) : [];
  const affected = s.db.sessions.filter((x) => x.tutorId === id && x.status === "scheduled" && dates.includes(x.date)).length;
  const submit = (event) => {
    event.preventDefault();
    if (!dates.length || !leaveType || (leaveType === "Other" && !otherReason.trim()) || !signature.trim()) return;
    const reason = leaveType === "Other" ? otherReason.trim() : leaveType;
    s.submitLeave(id, dates, `${reason}${note.trim() ? ` — ${note.trim()}` : ""}`, undefined, { leaveType, otherReason, note, signature });
    setFrom(""); setTo(""); setLeaveType(""); setOtherReason(""); setNote(""); setOk(true);
  };
  return <>
    <PageHeader title="Leave Request" />
    <Card className="mx-auto max-w-5xl space-y-5 !p-6 sm:!p-8">
      <h2 className="text-center text-2xl font-extrabold">Leave Form</h2>
      <p className="text-sm font-semibold text-slate-600">Date: <span className="underline">{fmtDate(todayISO())}</span></p>
      <form onSubmit={submit} className="space-y-5">
        <div className="overflow-hidden rounded-2xl border-2 border-slate-300 text-sm font-semibold text-slate-700">
          <div className="border-b-2 border-slate-300 px-5 py-4">Employee Name: {s.me.name || s.db.tutors.find((t) => t.userId === id)?.fullName || "Tutor"}</div>
          <div className="space-y-3 px-5 py-4"><p>Reason for requested leave: (please select appropriate option)</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{LEAVE_TYPES.map((type) => <label key={type} className="flex items-center gap-2"><input type="radio" name="leaveType" checked={leaveType === type} onChange={() => setLeaveType(type)}/>{type}{type === "Other" && <Input className="min-w-0" value={otherReason} onChange={(e) => setOtherReason(e.target.value)} aria-label="Other leave reason"/>}</label>)}</div>
          </div>
          <div className="grid gap-3 border-t-2 border-slate-300 px-5 py-4 sm:grid-cols-[auto_1fr_auto_1fr] sm:items-center"><span>Date Requested: from</span><Input type="date" min={todayISO()} required value={from} onChange={(e) => {setFrom(e.target.value);setOk(false);}}/><span>to</span><Input type="date" min={from || todayISO()} required value={to} onChange={(e) => {setTo(e.target.value);setOk(false);}}/></div>
        </div>
        <div className="grid gap-5 md:grid-cols-2"><Field label="Note"><Textarea placeholder="Add a note (optional)" value={note} onChange={(e) => setNote(e.target.value)}/></Field><div className="space-y-2"><Field label="Employee’s Signature"><Input required value={signature} onChange={(e) => setSignature(e.target.value)}/></Field><p className="text-xs text-slate-500">Typing your name serves as your electronic signature.</p></div></div>
        {affected > 0 && <Alert kind="warn">{affected} confirmed session(s) fall within these dates and may need reassignment if approved.</Alert>}
        {ok && <Alert kind="success">Leave request submitted. Status: Pending.</Alert>}
        <div className="flex flex-col-reverse gap-3 sm:flex-row"><Button type="button" variant="danger" className="flex-1" onClick={() => {setFrom("");setTo("");setLeaveType("");setOtherReason("");setNote("");setOk(false);}}>Reset</Button><Button type="submit" className="flex-1" disabled={!dates.length || !leaveType || !signature.trim()}>Submit Form</Button></div>
      </form>
    </Card>
    <section className="mx-auto mt-8 max-w-5xl"><h2 className="mb-3 text-xl font-extrabold">My Leave Requests</h2>{mine.length === 0 ? <Empty>No leave requests.</Empty> : <div className="overflow-x-auto rounded-2xl"><table className="w-full min-w-[600px] bg-white text-sm"><thead className="bg-slate-400 text-left text-white"><tr>{["Date Requested", "Date Approved/Rejected", "Status", ""].map((h)=><th key={h} className="px-4 py-3">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-200">{mine.map((l)=><tr key={l.id}><td className="px-4 py-3">{displayDate(leaveStart(l))} to {displayDate(leaveEnd(l))}</td><td>{l.decidedAt ? displayDate(l.decidedAt) : "—"}</td><td><Badge status={l.status}/></td><td><Button size="sm" variant="secondary" onClick={()=>setViewLeave(l)}>View Leave Form</Button></td></tr>)}</tbody></table></div>}</section>
    <Modal open={!!viewLeave} onClose={()=>setViewLeave(null)} title="Leave Form" wide>{viewLeave && <div className="space-y-3 text-sm text-slate-700"><p>Date: <b>{displayDate(viewLeave.submittedAt?.slice(0,10) || todayISO())}</b></p><div className="rounded-xl border-2 border-slate-300 p-4"><p>Employee Name: <b>{s.me.name || "Tutor"}</b></p><hr className="my-3"/><p>Reason for requested leave: <b>{viewLeave.leaveType || viewLeave.reason}</b></p><p className="mt-3">Date Requested: <b>{displayDate(leaveStart(viewLeave))} to {displayDate(leaveEnd(viewLeave))}</b></p></div><p>Note: {viewLeave.note || "—"}</p><p>Employee’s Signature: <span className="font-serif italic">{viewLeave.signature || s.me.name || "Tutor"}</span></p><Badge status={viewLeave.status}/></div>}</Modal>
  </>;
}
