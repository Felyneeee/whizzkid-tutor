"use client";
import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Empty, FilterPopover, FilterTrigger, Input, PageHeader, ProfileModal, Table, Td } from "@/components/ui";
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
    const hasBookedSession = s.db.bookings.some((booking) => booking.tuteeId === tutee.userId);
    const matchesFilter = filter === "all"
      || (filter === "enrolled" && hasEnrollment)
      || (filter === "previous" && hasBookedSession && !hasEnrollment)
      || (filter === "not-enrolled" && !hasBookedSession);
    return matchesQuery && matchesFilter;
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
        <FilterTrigger onClick={() => setShowFilters((value) => !value)} ariaLabel="Filter tutees" expanded={showFilters} count={(filter !== "all" ? 1 : 0) + (sortBy !== "name-asc" ? 1 : 0)}/>
        {showFilters && <FilterPopover onClear={() => { setFilter("all"); setSortBy("name-asc"); }} onApply={() => setShowFilters(false)}>
          <fieldset><legend className="mb-2 text-xs font-extrabold text-slate-700">Sort by</legend><div className="grid grid-cols-2 gap-1">{[["name-asc", "Name: A to Z"], ["name-desc", "Name: Z to A"], ["grade-asc", "Grade: ascending"], ["grade-desc", "Grade: descending"], ["created-newest", "Account: newest first"], ["created-oldest", "Account: oldest first"]].map(([value, label]) => <button type="button" key={value} aria-pressed={sortBy === value} onClick={() => setSortBy(value)} className={`rounded-lg px-2 py-1.5 text-left text-xs ${sortBy === value ? "bg-brand-50 font-bold text-brand-700" : "text-slate-700 hover:bg-slate-50"}`}>{label}</button>)}</div></fieldset>
          <fieldset><legend className="mb-2 text-xs font-extrabold text-slate-700">Enrollment</legend><div className="flex flex-wrap gap-1">{[["all", "All tutees"], ["enrolled", "Currently enrolled"], ["previous", "Previously enrolled"], ["not-enrolled", "Not enrolled yet"]].map(([value, label]) => <button type="button" key={value} aria-pressed={filter === value} onClick={() => setFilter(value)} className={`rounded-lg px-2 py-1.5 text-xs ${filter === value ? "bg-brand-50 font-bold text-brand-700" : "text-slate-700 hover:bg-slate-50"}`}>{label}</button>)}</div></fieldset>
        </FilterPopover>}
      </div>
    </div>
    {!tutees.length ? <Empty>No tutees found.</Empty> : <Table head={["Name", "Grade", "Age", "Email", "Contact", "Date Account Created", "Status", ""]}>
      {tutees.map((tutee) => {
        const enrolled = hasEnrollment(tutee);
        const hasBookedSession = s.db.bookings.some((booking) => booking.tuteeId === tutee.userId);
        const status = enrolled ? "Currently Enrolled" : hasBookedSession ? "Previously Enrolled" : "Not enrolled yet";
        return <tr key={tutee.userId} className="bg-white hover:bg-slate-50">
          <Td className="font-medium">{tutee.fullName || "(incomplete)"}</Td><Td>{tutee.gradeLevel || "—"}</Td><Td>{tutee.age != null ? `${tutee.age} y/o` : "—"}</Td><Td>{userOf(tutee.userId)?.email || "—"}</Td><Td>{tutee.contact || "—"}</Td><Td className="whitespace-nowrap">{createdLabel(userOf(tutee.userId)?.createdAt)}</Td>
          <Td><span className={`inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold ${enrolled ? "bg-mint-100 text-mint-600" : hasBookedSession ? "bg-brand-100 text-brand-700" : "bg-slate-100 text-slate-600"}`}>{status}</span></Td>
          <Td><button onClick={() => setSelected(tutee.userId)} className="whitespace-nowrap rounded-xl bg-brand-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-brand-700">View Profile</button></Td>
        </tr>;
      })}
    </Table>}

    <ProfileModal open={!!tee} onClose={closeProfile} title={tee?.fullName || "Tutee"}>
      {tee && <>
        <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
          <p><b>Birthday:</b> <span className="ml-1">{tee.birthday ? fmtDate(tee.birthday) : "—"}</span></p><p><b>Age:</b> <span className="ml-1">{tee.age ?? "—"}</span></p>
          <p><b>Grade:</b> <span className="ml-1">{tee.gradeLevel || "—"}</span></p><p><b>Guardian:</b> <span className="ml-1">{tee.guardianName || "—"}</span></p>
          <p><b>Contact:</b> <span className="ml-1">{tee.contact || "—"}</span></p><p><b>Last Enrolled:</b> <span className="ml-1">{latestCompletedSession?.date ? fmtDate(latestCompletedSession.date) : "---"}</span></p>
        </div>
        <div className="mt-5"><h3 className="mb-2 text-base font-bold text-slate-700">Initial Assessment</h3>{latestAssessment ? <div className="space-y-1"><p><b>Reading Level:</b> <span className="ml-1">{latestAssessment.readingLevel || "—"}</span></p><p><b>Assessment Results:</b> <span className="ml-1">{latestAssessment.results || "—"}</span></p><p><b>Learning Needs:</b> <span className="ml-1">{latestAssessment.learningNeeds || "—"}</span></p></div> : <p className="text-slate-500">No assessment recorded.</p>}</div>
        <button onClick={() => { const tuteeId = tee.userId; closeProfile(); router.push(`/admin/booking-records?tutee=${encodeURIComponent(tuteeId)}`); }} className="mt-6 w-full rounded-xl bg-brand-600 px-4 py-3 font-bold text-white hover:bg-brand-700">View Booking Records</button>
      </>}
    </ProfileModal>
  </>;
}
