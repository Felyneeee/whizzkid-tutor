"use client";
import { useCallback, useMemo, useState } from "react";
import { Badge, Empty, FilterPopover, FilterTrigger, Input, PageHeader, ProfileModal, Table, Td, Tabs } from "@/components/ui";

import { useStore } from "@/lib/store";
import { openPdfDataUrl } from "@/lib/files";
import Applications from "@/app/(dashboard)/admin/applications/page";
import Approvals from "@/app/(dashboard)/admin/approvals/page";

export default function TutorRecords() {
  const s = useStore();
  const [section, setSection] = useState("records");
  const [query, setQuery] = useState("");
  const [statusFilters, setStatusFilters] = useState([]);
  const [subjectFilters, setSubjectFilters] = useState([]);
  const [sortBy, setSortBy] = useState("name-asc");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const email = useCallback((id) => s.db.users.find((user) => user.id === id)?.email, [s.db.users]);
  const availableSubjects = useMemo(() => [...new Set(s.db.tutors.flatMap((tutor) => tutor.subjects || []).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [s.db.tutors]);
  const tutors = useMemo(() => s.db.tutors.filter((tutor) => {
    const statusGroup = tutor.status === "active" ? "active" : tutor.status === "rejected" ? "rejected" : "pending";
    const tutorSubjects = tutor.subjects || [];
    return (!statusFilters.length || statusFilters.includes(statusGroup)) && (!subjectFilters.length || subjectFilters.some((subject) => tutorSubjects.includes(subject))) && `${tutor.fullName} ${email(tutor.userId)}`.toLowerCase().includes(query.toLowerCase());
  }).sort((a, b) => {
    if (sortBy.startsWith("name")) {
      const result = String(a.fullName || "").localeCompare(String(b.fullName || ""), undefined, { sensitivity: "base" });
      return sortBy === "name-asc" ? result : -result;
    }
    const result = String(a.verifiedAt || "").localeCompare(String(b.verifiedAt || ""));
    return sortBy === "verified-oldest" ? result : -result;
  }), [s.db.tutors, email, query, statusFilters, subjectFilters, sortBy]);
  const tutor = selected ? s.db.tutors.find((item) => item.userId === selected) : null;
  const students = tutor ? [...new Set(s.db.sessions.filter((session) => session.tutorId === tutor.userId && session.status !== "cancelled").map((session) => s.db.tutees.find((tutee) => tutee.userId === session.tuteeId)?.fullName).filter(Boolean))] : [];
  return <>
    <PageHeader title="Tutor Records" />
    <Tabs tabs={[{ id: "records", label: "Tutor Records" }, { id: "schedules", label: "Tutor Schedules" }, { id: "leaves", label: "Leave Request" }, { id: "verification", label: "Account Verification" }]} value={section} onChange={setSection} />
    {section === "schedules" && <Approvals embedded defaultTab="schedules" />}
    {section === "leaves" && <Approvals embedded defaultTab="leaves" />}
    {section === "verification" && <Applications embedded />}
    {section === "records" && <>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><Input className="max-w-sm" placeholder="Search name or email…" value={query} onChange={(event) => setQuery(event.target.value)} /><div className="relative"><FilterTrigger onClick={() => setFiltersOpen((open) => !open)} ariaLabel="Filter tutor records" expanded={filtersOpen} count={statusFilters.length + subjectFilters.length + (sortBy !== "name-asc" ? 1 : 0)}/>{filtersOpen && <FilterPopover onClear={() => { setStatusFilters([]); setSubjectFilters([]); setSortBy("name-asc"); }} onApply={() => setFiltersOpen(false)}><fieldset><legend className="mb-2 text-xs font-extrabold text-slate-700">Sort by</legend><div className="grid grid-cols-2 gap-1">{[["name-asc", "Name: A to Z"], ["name-desc", "Name: Z to A"], ["verified-newest", "Verified: newest"], ["verified-oldest", "Verified: oldest"]].map(([value, label]) => <label key={value} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-slate-700 hover:bg-brand-50"><input type="radio" name="tutor-record-sort" checked={sortBy === value} onChange={() => setSortBy(value)} className="accent-brand-600"/>{label}</label>)}</div></fieldset><fieldset className="mt-3 border-t border-slate-100 pt-3"><legend className="mb-2 text-xs font-extrabold text-slate-700">Status</legend><div className="flex flex-wrap gap-2">{[["active", "Active"], ["pending", "Pending"], ["rejected", "Rejected"]].map(([value, label]) => <label key={value} className="flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-slate-700 hover:bg-brand-50"><input type="checkbox" checked={statusFilters.includes(value)} onChange={() => setStatusFilters((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value])} className="accent-brand-600"/>{label}</label>)}</div></fieldset><fieldset className="mt-3 border-t border-slate-100 pt-3"><legend className="mb-2 text-xs font-extrabold text-slate-700">Subjects</legend><div className="flex max-h-32 flex-wrap gap-2 overflow-y-auto">{availableSubjects.map((subject) => <label key={subject} className="flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-slate-700 hover:bg-brand-50"><input type="checkbox" checked={subjectFilters.includes(subject)} onChange={() => setSubjectFilters((current) => current.includes(subject) ? current.filter((item) => item !== subject) : [...current, subject])} className="accent-brand-600"/>{subject}</label>)}</div></fieldset></FilterPopover>}</div></div>
    {!tutors.length ? <Empty>No tutors found.</Empty> : <Table head={["Name", "Status", "Date verified", "Subjects", ""]}>
      {tutors.map((item) => <tr key={item.userId} className="cursor-pointer hover:bg-slate-50" onClick={() => setSelected(item.userId)}>
        <Td className="font-bold">{item.fullName}<div className="text-xs font-normal text-slate-400">{email(item.userId)}</div></Td><Td><Badge status={item.status}/></Td><Td>{item.verifiedAt ? new Date(item.verifiedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}</Td><Td>{item.subjects?.join(", ") || "—"}</Td><Td className="text-brand-600">View Profile</Td>
      </tr>)}
    </Table>}
    <ProfileModal open={!!tutor} onClose={() => setSelected(null)} title={tutor?.fullName || "Tutor Profile"}>
      {tutor && <div className="space-y-3"><div className="grid grid-cols-2 gap-2"><div><b>Email:</b> {email(tutor.userId)}</div><div><b>Status:</b> <Badge status={tutor.status}/></div><div><b>Age:</b> {tutor.age ?? "—"}</div><div><b>Contact:</b> {tutor.contact || "—"}</div><div className="col-span-2"><b>Subjects:</b> {tutor.subjects?.join(", ") || "—"}</div><div className="col-span-2"><b>Grade bands:</b> {tutor.gradeBands?.join(", ") || "—"}</div></div><div><b>Assigned students:</b> {students.join(", ") || "None"}</div><div className="border-t border-slate-100 pt-3"><b>Resume:</b>{tutor.resumeData ? <button type="button" onClick={() => openPdfDataUrl(tutor.resumeData)} className="ml-2 font-bold text-brand-600 underline hover:text-brand-700">View {tutor.resumeName || "resume PDF"}</button> : <span className="ml-2 text-slate-500">No resume uploaded</span>}</div></div>}
    </ProfileModal>
    </>}
  </>;
}
