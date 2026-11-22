"use client";
import { useState } from "react";
import { Badge, Empty, Input, Modal, PageHeader, Select, Table, Td, Tabs } from "@/components/ui";
import { useStore } from "@/lib/store";
import Applications from "@/app/(dashboard)/admin/applications/page";
import Approvals from "@/app/(dashboard)/admin/approvals/page";

export default function TutorRecords() {
  const s = useStore();
  const [section, setSection] = useState("records");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selected, setSelected] = useState(null);
  const email = (id) => s.db.users.find((user) => user.id === id)?.email;
  const tutors = s.db.tutors.filter((tutor) => (statusFilter === "All" || tutor.status === statusFilter.toLowerCase()) && `${tutor.fullName} ${email(tutor.userId)}`.toLowerCase().includes(query.toLowerCase()));
  const tutor = selected ? s.db.tutors.find((item) => item.userId === selected) : null;
  const students = tutor ? [...new Set(s.db.sessions.filter((session) => session.tutorId === tutor.userId && session.status !== "cancelled").map((session) => s.db.tutees.find((tutee) => tutee.userId === session.tuteeId)?.fullName).filter(Boolean))] : [];
  const labels = { records: "Tutor Records", schedules: "Tutor Schedules", leaves: "Leave Requests", verification: "Account Verification" };
  return <>
    <PageHeader title={labels[section]} />
    <Tabs tabs={[{ id: "records", label: "Tutor Records" }, { id: "schedules", label: "Tutor Schedules" }, { id: "leaves", label: "Leave Request" }, { id: "verification", label: "Account Verification" }]} value={section} onChange={setSection} />
    {section === "schedules" && <Approvals embedded defaultTab="schedules" />}
    {section === "leaves" && <Approvals embedded defaultTab="leaves" />}
    {section === "verification" && <Applications embedded />}
    {section === "records" && <>
    <div className="mb-4 flex flex-wrap items-center gap-3"><Input className="max-w-sm" placeholder="Search name or email…" value={query} onChange={(event) => setQuery(event.target.value)} /><Select className="max-w-[200px]" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>All</option><option value="active">Active</option><option value="pending">Pending</option><option value="rejected">Rejected</option></Select></div>
    {!tutors.length ? <Empty>No tutors found.</Empty> : <Table head={["Name", "Status", "Date verified", "Subjects", ""]}>
      {tutors.map((item) => <tr key={item.userId} className="cursor-pointer hover:bg-slate-50" onClick={() => setSelected(item.userId)}>
        <Td className="font-bold">{item.fullName}<div className="text-xs font-normal text-slate-400">{email(item.userId)}</div></Td><Td><Badge status={item.status}/></Td><Td>{item.verifiedAt ? new Date(item.verifiedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}</Td><Td>{item.subjects?.join(", ") || "—"}</Td><Td className="text-brand-600">View Profile</Td>
      </tr>)}
    </Table>}
    <Modal open={!!tutor} onClose={() => setSelected(null)} title={tutor?.fullName || "Tutor Profile"} wide>
      {tutor && <div className="space-y-3 text-sm"><div className="grid grid-cols-2 gap-2"><div><b>Email:</b> {email(tutor.userId)}</div><div><b>Status:</b> <Badge status={tutor.status}/></div><div><b>Age:</b> {tutor.age ?? "—"}</div><div><b>Contact:</b> {tutor.contact || "—"}</div><div className="col-span-2"><b>Subjects:</b> {tutor.subjects?.join(", ") || "—"}</div><div className="col-span-2"><b>Grade bands:</b> {tutor.gradeBands?.join(", ") || "—"}</div></div>{tutor.bio && <p className="rounded-xl bg-slate-50 p-3">{tutor.bio}</p>}<div><b>Assigned students:</b> {students.join(", ") || "None"}</div></div>}
    </Modal>
    </>}
  </>;
}
