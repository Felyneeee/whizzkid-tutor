"use client";
import { useState } from "react";
import { Badge, Empty, Input, Modal, PageHeader, Table, Tabs, Td } from "@/components/ui";
import { fmtDate } from "@/lib/dates";
import { useStore } from "@/lib/store";
export default function Records() {
    const s = useStore();
    const [tab, setTab] = useState("tutees");
    const [q, setQ] = useState("");
    const [sel, setSel] = useState(null);
    const userOf = (id) => s.db.users.find((u) => u.id === id);
    const tutees = s.db.tutees.filter((t) => `${t.fullName} ${userOf(t.userId)?.email}`.toLowerCase().includes(q.toLowerCase()));
    const tutors = s.db.tutors.filter((t) => `${t.fullName} ${userOf(t.userId)?.email}`.toLowerCase().includes(q.toLowerCase()));
    const tee = sel?.kind === "tutee" ? s.db.tutees.find((t) => t.userId === sel.id) : null;
    const tor = sel?.kind === "tutor" ? s.db.tutors.find((t) => t.userId === sel.id) : null;
    const nm = (id) => s.db.tutors.find((t) => t.userId === id)?.fullName || s.db.tutees.find((t) => t.userId === id)?.fullName || "—";
    return (<>
      <PageHeader title="Tutee & tutor records" subtitle="Only admins can see the full records of every tutee and tutor."/>
      <Tabs tabs={[{ id: "tutees", label: `Tutees (${s.db.tutees.length})` }, { id: "tutors", label: `Tutors (${s.db.tutors.length})` }]} value={tab} onChange={setTab}/>
      <div className="mb-4 max-w-sm"><Input placeholder="Search name or email…" value={q} onChange={(e) => setQ(e.target.value)}/></div>
      {tab === "tutees" ? (tutees.length === 0 ? <Empty>No tutees found.</Empty> : (<Table head={["Name", "Grade", "Age", "Email / Username", "Contact", "Profile", ""]}>
          {tutees.map((t) => (<tr key={t.userId} className="cursor-pointer hover:bg-slate-50" onClick={() => setSel({ kind: "tutee", id: t.userId })}>
              <Td className="font-bold">{t.fullName || "(incomplete)"}</Td><Td>{t.gradeLevel}</Td><Td>{t.age ?? "—"}</Td><Td>{userOf(t.userId)?.email}<div className="text-xs text-slate-400">@{userOf(t.userId)?.username}</div></Td><Td>{t.contact}</Td>
              <Td><Badge status={t.complete ? "approved" : "pending"}>{t.complete ? "complete" : "incomplete"}</Badge></Td><Td className="text-brand-600">View</Td>
            </tr>))}
        </Table>)) : (tutors.length === 0 ? <Empty>No tutors found.</Empty> : (<Table head={["Name", "Status", "Type", "Subjects", "Rate/hr", "Fixed", ""]}>
          {tutors.map((t) => (<tr key={t.userId} className="cursor-pointer hover:bg-slate-50" onClick={() => setSel({ kind: "tutor", id: t.userId })}>
              <Td className="font-bold">{t.fullName}<div className="text-xs font-normal text-slate-400">{userOf(t.userId)?.email}</div></Td><Td><Badge status={t.status}/></Td><Td className="capitalize">{t.applicantType}</Td><Td>{t.subjects.join(", ")}</Td><Td>₱{t.hourlyRate}</Td><Td>₱{t.fixedSalary}</Td><Td className="text-brand-600">View</Td>
            </tr>))}
        </Table>))}
      <Modal open={!!sel} onClose={() => setSel(null)} title={tee?.fullName || tor?.fullName || "Record"} wide>
        {tee && (<div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-2"><div><b>Birthday:</b> {tee.birthday ? fmtDate(tee.birthday) : "—"}</div><div><b>Age:</b> {tee.age ?? "—"}</div><div><b>Grade:</b> {tee.gradeLevel}</div><div><b>Guardian:</b> {tee.guardianName || "—"}</div><div className="col-span-2"><b>Contact:</b> {tee.contact}</div></div>
            <div><h4 className="mb-1 font-extrabold">Assessments & learning needs</h4>{s.db.assessments.filter((a) => a.tuteeId === tee.userId).map((a) => <div key={a.id} className="rounded-xl bg-slate-50 p-2">{fmtDate(a.date)} · <Badge status={a.status}/>{a.readingLevel && <> <b>{a.readingLevel}</b> — {a.learningNeeds}</>}</div>)}{!s.db.assessments.some((a) => a.tuteeId === tee.userId) && <p className="text-slate-400">None.</p>}</div>
            <div><h4 className="mb-1 font-extrabold">Bookings</h4>{s.db.bookings.filter((b) => b.tuteeId === tee.userId).map((b) => { const tutorNames = [...new Set(s.db.sessions.filter((session) => session.bookingId === b.id && session.status !== "cancelled").map((session) => session.tutorId))].map(nm); return <div key={b.id} className="mb-1 flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 p-2"><span className="capitalize font-bold">{b.program} · {[...new Set(b.sessionSlots?.map((slot) => slot.subject) || [b.subject])].join(", ")}</span><Badge status={b.status}/><span className="text-slate-500">Tutor: {tutorNames.join(", ") || (b.tutorId ? nm(b.tutorId) : "unassigned")}</span></div>; })}{!s.db.bookings.some((b) => b.tuteeId === tee.userId) && <p className="text-slate-400">None.</p>}</div>
          </div>)}
        {tor && (<div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2"><div><b>Status:</b> <Badge status={tor.status}/></div><div><b>Age:</b> {tor.age ?? "—"}</div><div><b>Contact:</b> {tor.contact}</div><div><b>Resume:</b> {tor.resumeName || "—"}</div><div className="col-span-2"><b>Subjects:</b> {tor.subjects.join(", ")}</div><div className="col-span-2"><b>Grade bands:</b> {tor.gradeBands.join(", ")}</div></div>
            {tor.bio && <p className="rounded-xl bg-slate-50 p-3">{tor.bio}</p>}
            <div><b>Employment:</b> ₱{tor.hourlyRate}/hr + ₱{tor.fixedSalary} fixed</div>
            <div><b>Assigned students:</b> {[...new Set(s.db.sessions.filter((session) => session.tutorId === tor.userId && session.status !== "cancelled").map((session) => nm(session.tuteeId)))].join(", ") || "none"}</div>
          </div>)}
      </Modal>
    </>);
}
