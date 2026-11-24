"use client";
import { useCallback, useMemo, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { Empty, Input, PageHeader, Table, Td } from "@/components/ui";
import { fmtDate } from "@/lib/dates";
import { useStore } from "@/lib/store";

const enrolledStatuses = new Set(["active", "confirmed", "booked", "completed", "paid", "released"]);
const createdLabel = (value) => value ? new Date(value).toLocaleString("en-PH", { dateStyle: "long", timeStyle: "short" }) : "—";

export default function TuteeRecords() {
  const s = useStore();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [sortBy, setSortBy] = useState("name-asc");
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState(null);
  const userOf = useCallback((id) => s.db.users.find((user) => user.id === id), [s.db.users]);
  const tutees = useMemo(() => s.db.tutees.filter((tutee) => {
    const matchesQuery = `${tutee.fullName} ${userOf(tutee.userId)?.email || ""}`.toLowerCase().includes(q.toLowerCase());
    const hasEnrollment = s.db.bookings.some((booking) => booking.tuteeId === tutee.userId && enrolledStatuses.has(booking.status));
    return matchesQuery && (filter === "all" || (filter === "enrolled" ? hasEnrollment : !hasEnrollment));
  }).sort((a, b) => {
    if (sortBy.startsWith("name")) {
      const result = String(a.fullName || "").localeCompare(String(b.fullName || ""), undefined, { sensitivity: "base" });
      return sortBy === "name-asc" ? result : -result;
    }
    if (sortBy.startsWith("grade")) {
      const result = String(a.gradeLevel || "").localeCompare(String(b.gradeLevel || ""), undefined, { numeric: true, sensitivity: "base" });
      return sortBy === "grade-asc" ? result : -result;
    }
    const aCreated = userOf(a.userId)?.createdAt || "";
    const bCreated = userOf(b.userId)?.createdAt || "";
    const result = String(aCreated).localeCompare(String(bCreated));
    return sortBy === "created-newest" ? -result : result;
  }), [s.db.tutees, s.db.bookings, q, filter, sortBy, userOf]);
  const tee = selected ? s.db.tutees.find((tutee) => tutee.userId === selected) : null;
  const assessments = tee ? s.db.assessments.filter((assessment) => assessment.tuteeId === tee.userId).sort((a, b) => String(b.completedAt || b.date || b.createdAt || "").localeCompare(String(a.completedAt || a.date || a.createdAt || ""))) : [];
  const latestAssessment = assessments.find((assessment) => assessment.status === "completed") || assessments[0];
  const latestCompletedSession = tee ? s.db.sessions
    .filter((session) => session.tuteeId === tee.userId && session.status === "completed")
    .sort((a, b) => `${b.date || ""}${b.time || ""}`.localeCompare(`${a.date || ""}${a.time || ""}`))[0] : null;
  const hasEnrollment = (tutee) => s.db.bookings.some((booking) => booking.tuteeId === tutee.userId && enrolledStatuses.has(booking.status));
  const closeProfile = () => setSelected(null);

  return <>
    <PageHeader title="Tutee" />
    <div className="mb-6 flex items-center justify-between gap-4">
      <Input className="max-w-md rounded-2xl border-2 border-slate-300 px-5 py-3" placeholder="Search name or email..." value={q} onChange={(event) => setQ(event.target.value)} />
      <div className="relative">
        <button onClick={() => setShowFilters((value) => !value)} aria-label="Filter tutees" aria-expanded={showFilters} className="rounded-xl p-2.5 text-brand-600 hover:bg-brand-50"><SlidersHorizontal className="h-5 w-5" /></button>
        {showFilters && <div className="absolute right-0 z-10 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
          <p className="mb-1 px-2 pt-1 text-xs font-bold uppercase tracking-wide text-slate-400">Enrollment</p>
          {[["all", "All tutees"], ["enrolled", "Currently enrolled"], ["previous", "Previously enrolled"]].map(([value, label]) => <button key={value} onClick={() => setFilter(value)} className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${filter === value ? "bg-brand-50 font-bold text-brand-700" : "hover:bg-slate-50"}`}>{label}</button>)}
          <p className="mb-1 mt-3 border-t border-slate-100 px-2 pt-3 text-xs font-bold uppercase tracking-wide text-slate-400">Sort by</p>
          {[ ["name-asc", "Name: A to Z"], ["name-desc", "Name: Z to A"], ["grade-asc", "Grade: ascending"], ["grade-desc", "Grade: descending"], ["created-newest", "Account: newest first"], ["created-oldest", "Account: oldest first"] ].map(([value, label]) => <button key={value} onClick={() => setSortBy(value)} className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${sortBy === value ? "bg-brand-50 font-bold text-brand-700" : "hover:bg-slate-50"}`}>{label}</button>)}
          <button onClick={() => setShowFilters(false)} className="mt-2 w-full rounded-lg bg-brand-600 px-3 py-2 text-sm font-bold text-white">Done</button>
        </div>}
      </div>
    </div>
    {!tutees.length ? <Empty>No tutees found.</Empty> : <Table head={["Name", "Grade", "Age", "Email", "Contact", "Date Account Created", "Status", ""]}>
      {tutees.map((tutee) => {
        const enrolled = hasEnrollment(tutee);
        return <tr key={tutee.userId} className="bg-white hover:bg-slate-50">
          <Td className="font-medium">{tutee.fullName || "(incomplete)"}</Td><Td>{tutee.gradeLevel || "—"}</Td><Td>{tutee.age != null ? `${tutee.age} y/o` : "—"}</Td><Td>{userOf(tutee.userId)?.email || "—"}</Td><Td>{tutee.contact || "—"}</Td><Td className="whitespace-nowrap">{createdLabel(userOf(tutee.userId)?.createdAt)}</Td>
          <Td><span className={`inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold ${enrolled ? "bg-mint-100 text-mint-600" : "bg-brand-100 text-brand-700"}`}>{enrolled ? "Currently Enrolled" : "Previously Enrolled"}</span></Td>
          <Td><button onClick={() => setSelected(tutee.userId)} className="whitespace-nowrap rounded-xl bg-brand-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-brand-700">View Profile</button></Td>
        </tr>;
      })}
    </Table>}

    {tee && <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/40 p-4" onClick={closeProfile}>
      <section role="dialog" aria-modal="true" aria-labelledby="tutee-profile-title" className="my-auto w-full max-w-5xl rounded-3xl bg-white p-6 shadow-2xl sm:p-8" onClick={(event) => event.stopPropagation()}>
        <div className="mb-6 flex items-center justify-between"><h2 id="tutee-profile-title" className="text-2xl font-extrabold text-slate-800">{tee.fullName || "Tutee"}</h2><button onClick={closeProfile} aria-label="Close profile" className="rounded-lg p-1 text-slate-600 hover:bg-slate-100"><span className="text-3xl leading-none">×</span></button></div>
        <div className="grid gap-x-8 gap-y-3 text-base text-slate-700 sm:grid-cols-2">
          <p><b>Birthday:</b> <span className="ml-1">{tee.birthday ? fmtDate(tee.birthday) : "—"}</span></p><p><b>Age:</b> <span className="ml-1">{tee.age ?? "—"}</span></p>
          <p><b>Grade:</b> <span className="ml-1">{tee.gradeLevel || "—"}</span></p><p><b>Guardian:</b> <span className="ml-1">{tee.guardianName || "—"}</span></p>
          <p><b>Contact:</b> <span className="ml-1">{tee.contact || "—"}</span></p><p><b>Last Enrolled:</b> <span className="ml-1">{latestCompletedSession?.date ? fmtDate(latestCompletedSession.date) : "---"}</span></p>
        </div>
        <div className="mt-5"><h3 className="mb-2 text-xl font-bold text-slate-700">Initial Assessment</h3>{latestAssessment ? <div className="space-y-1 text-base text-slate-700"><p><b>Reading Level:</b> <span className="ml-1">{latestAssessment.readingLevel || "—"}</span></p><p><b>Assessment Results:</b> <span className="ml-1">{latestAssessment.results || "—"}</span></p><p><b>Learning Needs:</b> <span className="ml-1">{latestAssessment.learningNeeds || "—"}</span></p></div> : <p className="text-sm text-slate-500">No assessment recorded.</p>}</div>
        <button onClick={() => { const tuteeId = tee.userId; closeProfile(); router.push(`/admin/booking-records?tutee=${encodeURIComponent(tuteeId)}`); }} className="mt-7 w-full rounded-2xl bg-brand-600 px-5 py-4 text-lg font-bold text-white hover:bg-brand-700">View Booking Records</button>
      </section>
    </div>}
  </>;
}
