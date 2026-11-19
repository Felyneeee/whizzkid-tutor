"use client";
import { useState } from "react";
import { Badge, Empty, Input, Modal, PageHeader, Table, Td } from "@/components/ui";
import { fmtDate } from "@/lib/dates";
import { useStore } from "@/lib/store";
export default function TuteeRecords() {
  const s = useStore();
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState(null);
  const userOf = (id) => s.db.users.find((user) => user.id === id);
  const tutees = s.db.tutees.filter((tutee) => `${tutee.fullName} ${userOf(tutee.userId)?.email}`.toLowerCase().includes(q.toLowerCase()));
  const tee = selected ? s.db.tutees.find((tutee) => tutee.userId === selected) : null;
  const nm = (id) => s.db.tutors.find((tutor) => tutor.userId === id)?.fullName || s.db.tutees.find((tutee) => tutee.userId === id)?.fullName || "—";
  return <>
    <PageHeader title="Tutee Records" />
    <div className="mb-4 max-w-sm"><Input placeholder="Search name or email…" value={q} onChange={(event) => setQ(event.target.value)} /></div>
    {!tutees.length ? <Empty>No tutees found.</Empty> : <Table head={["Name", "Grade", "Age", "Email / Username", "Contact", "Profile", ""]}>
      {tutees.map((tutee) => <tr key={tutee.userId} className="cursor-pointer hover:bg-slate-50" onClick={() => setSelected(tutee.userId)}>
        <Td className="font-bold">{tutee.fullName || "(incomplete)"}</Td><Td>{tutee.gradeLevel}</Td><Td>{tutee.age ?? "—"}</Td><Td>{userOf(tutee.userId)?.email}<div className="text-xs text-slate-400">@{userOf(tutee.userId)?.username}</div></Td><Td>{tutee.contact}</Td><Td><Badge status={tutee.complete ? "approved" : "pending"}>{tutee.complete ? "complete" : "incomplete"}</Badge></Td><Td className="text-brand-600">View</Td>
      </tr>)}
    </Table>}
    <Modal open={!!tee} onClose={() => setSelected(null)} title={tee?.fullName || "Tutee Record"} wide>
      {tee && <div className="space-y-4 text-sm">
        <div className="grid grid-cols-2 gap-2"><div><b>Birthday:</b> {tee.birthday ? fmtDate(tee.birthday) : "—"}</div><div><b>Age:</b> {tee.age ?? "—"}</div><div><b>Grade:</b> {tee.gradeLevel}</div><div><b>Guardian:</b> {tee.guardianName || "—"}</div><div className="col-span-2"><b>Contact:</b> {tee.contact}</div></div>
        <div><h4 className="mb-1 font-extrabold">Assessments & learning needs</h4>{s.db.assessments.filter((assessment) => assessment.tuteeId === tee.userId).map((assessment) => <div key={assessment.id} className="rounded-xl bg-slate-50 p-2">{fmtDate(assessment.date)} · <Badge status={assessment.status}/>{assessment.readingLevel && <> <b>{assessment.readingLevel}</b> — {assessment.learningNeeds}</>}</div>)}{!s.db.assessments.some((assessment) => assessment.tuteeId === tee.userId) && <p className="text-slate-400">None.</p>}</div>
        <div><h4 className="mb-1 font-extrabold">Bookings</h4>{s.db.bookings.filter((booking) => booking.tuteeId === tee.userId).map((booking) => { const tutorNames = [...new Set(s.db.sessions.filter((session) => session.bookingId === booking.id && session.status !== "cancelled").map((session) => session.tutorId))].map(nm); return <div key={booking.id} className="mb-1 flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 p-2"><span className="capitalize font-bold">{booking.program} · {[...new Set(booking.sessionSlots?.map((slot) => slot.subject) || [booking.subject])].join(", ")}</span><Badge status={booking.status}/><span className="text-slate-500">Tutor: {tutorNames.join(", ") || (booking.tutorId ? nm(booking.tutorId) : "unassigned")}</span></div>; })}{!s.db.bookings.some((booking) => booking.tuteeId === tee.userId) && <p className="text-slate-400">None.</p>}</div>
      </div>}
    </Modal>
  </>;
}
